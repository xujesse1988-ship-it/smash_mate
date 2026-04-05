/**
 * L2 跨模块集成测试: 约球活动全流程
 * 关键路径: 发起活动 → 加入活动 → 活动状态流转到已结束 → 录入战绩 → 查看活动战绩列表
 *
 * 涉及模块: user, venue, activity, match-record, notification
 * 测试层级: 真实模块间调用（不 Mock 其他模块），真实 PostgreSQL 测试库
 *
 * 对应 Issue: #55
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '@server/app.js';
import { config } from '@server/infra/config.js';
import { createTestUser, cleanupUserTestData } from '@tests/fixtures/user.js';
import { createTestCity, createTestVenue, cleanupVenueTestData } from '@tests/fixtures/venue.js';
import {
  cleanupActivityTestData,
} from '@tests/fixtures/activity.js';
import { cleanupMatchRecordTestData, getTestPrisma } from '@tests/fixtures/match-record.js';
import { cleanupNotificationTestData } from '@tests/fixtures/notification.js';

const prisma = getTestPrisma();

function signToken(userId: string): string {
  return jwt.sign({ userId, role: 'user' }, config.jwtSecret, { expiresIn: '7d' });
}

/** Create a date in the past (hours ago from now) */
function pastDate(hoursAgo: number): Date {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
}

/** Create a date in the future (hours from now) */
function futureDate(hoursFromNow: number): Date {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
}

async function cleanup() {
  await cleanupMatchRecordTestData();
  await cleanupNotificationTestData();
  await cleanupActivityTestData();
  await cleanupVenueTestData();
  await cleanupUserTestData();
}

beforeAll(async () => {
  await cleanup();
});

afterEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// =============================================================================
// 正常流程: 约球活动全生命周期
// =============================================================================

describe('关键路径: 约球活动全流程（发起→加入→结束→录入战绩→查看战绩）', () => {
  it('完整正常流程: 发起活动 → 他人加入 → 活动状态变为已结束 → 参与者录入战绩 → 查看活动战绩列表', async () => {
    // -----------------------------------------------------------------------
    // Step 1: 准备测试数据 — 创建用户和球馆
    // -----------------------------------------------------------------------
    const creator = await createTestUser({ nickname: '发起人小王' });
    const joiner = await createTestUser({ nickname: '参与者小李' });
    const city = await createTestCity({ name: '北京' });
    const venue = await createTestVenue({
      cityId: city.id,
      name: '朝阳体育中心',
      mapPoiId: 'poi-l2-1',
    });

    const creatorToken = signToken(creator.id);
    const joinerToken = signToken(joiner.id);

    // -----------------------------------------------------------------------
    // Step 2: 发起人创建活动（activity 模块 — POST /api/activities）
    // -----------------------------------------------------------------------
    const createRes = await request(app)
      .post('/api/activities')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        venueId: venue.id,
        title: 'L2测试约球',
        startTime: futureDate(2).toISOString(),
        endTime: futureDate(4).toISOString(),
        maxParticipants: 8,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.status).toBe('open');
    expect(createRes.body.data.currentParticipants).toBe(1); // creator auto-joined

    const activityId = createRes.body.data.id;

    // -----------------------------------------------------------------------
    // Step 3: 他人加入活动（activity 模块 — POST /api/activities/:id/join）
    //         验证跨模块通知：加入活动时通知发起人（activity → notification）
    // -----------------------------------------------------------------------
    const joinRes = await request(app)
      .post(`/api/activities/${activityId}/join`)
      .set('Authorization', `Bearer ${joinerToken}`);

    expect(joinRes.status).toBe(200);
    expect(joinRes.body.data.currentParticipants).toBe(2);

    // 验证通知: 发起人收到"新成员加入"通知（activity → notification 跨模块调用）
    const notifications = await prisma.notification.findMany({
      where: { userId: creator.id, type: 'ACTIVITY_JOINED' },
    });
    expect(notifications.length).toBe(1);
    expect(notifications[0].targetType).toBe('activity');
    expect(notifications[0].targetId).toBe(activityId);
    expect(notifications[0].content).toContain('参与者小李');

    // -----------------------------------------------------------------------
    // Step 4: 活动状态变为已结束
    //         模拟时间流逝：直接将活动时间设为过去，再调用状态流转
    // -----------------------------------------------------------------------
    await prisma.activity.update({
      where: { id: activityId },
      data: {
        startTime: pastDate(4),
        endTime: pastDate(2),
        status: 'in_progress', // first transition: open → in_progress
      },
    });

    // 调用 activity 的状态流转任务（模拟定时任务触发）
    // 通过直接构造 ActivityService 来调用 transitionStatuses
    const { ActivityService } = await import('@server/modules/activity/service.js');
    const { ActivityRepository } = await import('@server/modules/activity/repository.js');
    const { VenueService } = await import('@server/modules/venue/service.js');
    const { VenueRepository } = await import('@server/modules/venue/repository.js');
    const { UserService } = await import('@server/modules/user/service.js');
    const { UserRepository } = await import('@server/modules/user/repository.js');
    const { NotificationService } = await import('@server/modules/notification/service.js');
    const { NotificationRepository } = await import('@server/modules/notification/repository.js');

    const activityService = new ActivityService(
      new ActivityRepository(),
      new VenueService(new VenueRepository()),
      new UserService(new UserRepository()),
      new NotificationService(new NotificationRepository()),
    );

    await activityService.transitionStatuses();

    // 验证活动状态已变为 completed
    const activityAfterTransition = await prisma.activity.findUnique({
      where: { id: activityId },
    });
    expect(activityAfterTransition!.status).toBe('completed');

    // -----------------------------------------------------------------------
    // Step 5: 参与者录入战绩（match-record 模块 — POST /api/match-records）
    //         跨模块调用: match-record → activity（校验参与关系 + 活动状态）
    // -----------------------------------------------------------------------
    const recordRes = await request(app)
      .post('/api/match-records')
      .set('Authorization', `Bearer ${joinerToken}`)
      .send({
        sourceType: 'activity',
        sourceId: activityId,
        matchType: 'singles',
        players: {
          sideA: [{ userId: creator.id }],
          sideB: [{ userId: joiner.id }],
        },
        games: [
          { scoreA: 21, scoreB: 18 },
          { scoreA: 15, scoreB: 21 },
          { scoreA: 21, scoreB: 19 },
        ],
      });

    expect(recordRes.status).toBe(201);
    expect(recordRes.body.data.sourceType).toBe('activity');
    expect(recordRes.body.data.sourceId).toBe(activityId);
    expect(recordRes.body.data.matchType).toBe('singles');
    expect(recordRes.body.data.recordedBy).toBe(joiner.id);
    expect(recordRes.body.data.result).toBe('A_WIN'); // creator wins 2-1
    expect(recordRes.body.data.games).toHaveLength(3);
    expect(recordRes.body.data.players.sideA).toHaveLength(1);
    expect(recordRes.body.data.players.sideB).toHaveLength(1);

    const matchRecordId = recordRes.body.data.id;

    // -----------------------------------------------------------------------
    // Step 6: 查看活动战绩列表（match-record 模块 — GET /api/activities/:id/match-records）
    // -----------------------------------------------------------------------
    const listRes = await request(app)
      .get(`/api/activities/${activityId}/match-records`)
      .set('Authorization', `Bearer ${creatorToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.items).toHaveLength(1);
    expect(listRes.body.data.items[0].id).toBe(matchRecordId);
    expect(listRes.body.data.items[0].result).toBe('A_WIN');

    // -----------------------------------------------------------------------
    // Step 7: 验证用户个人战绩汇总（match-record 模块 — GET /api/users/:id/match-stats）
    //         跨模块验证: 录入的战绩正确反映在用户统计中
    // -----------------------------------------------------------------------
    const creatorStatsRes = await request(app)
      .get(`/api/users/${creator.id}/match-stats`)
      .set('Authorization', `Bearer ${creatorToken}`);

    expect(creatorStatsRes.status).toBe(200);
    expect(creatorStatsRes.body.data.totalMatches).toBe(1);
    expect(creatorStatsRes.body.data.wins).toBe(1);
    expect(creatorStatsRes.body.data.losses).toBe(0);

    const joinerStatsRes = await request(app)
      .get(`/api/users/${joiner.id}/match-stats`)
      .set('Authorization', `Bearer ${joinerToken}`);

    expect(joinerStatsRes.status).toBe(200);
    expect(joinerStatsRes.body.data.totalMatches).toBe(1);
    expect(joinerStatsRes.body.data.wins).toBe(0);
    expect(joinerStatsRes.body.data.losses).toBe(1);
  });

  it('完整流程含双打和临时用户: 4人活动 → 双打战绩录入（含 guestName）', async () => {
    // 准备数据
    const creator = await createTestUser({ nickname: '组织者' });
    const player2 = await createTestUser({ nickname: '球友二' });
    const player3 = await createTestUser({ nickname: '球友三' });
    const city = await createTestCity({ name: '上海' });
    const venue = await createTestVenue({
      cityId: city.id,
      name: '静安体育馆',
      mapPoiId: 'poi-l2-2',
    });

    const creatorToken = signToken(creator.id);
    const player2Token = signToken(player2.id);
    const player3Token = signToken(player3.id);

    // 创建活动
    const createRes = await request(app)
      .post('/api/activities')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        venueId: venue.id,
        startTime: futureDate(2).toISOString(),
        endTime: futureDate(4).toISOString(),
        maxParticipants: 6,
      });

    expect(createRes.status).toBe(201);
    const activityId = createRes.body.data.id;

    // player2 和 player3 加入
    await request(app)
      .post(`/api/activities/${activityId}/join`)
      .set('Authorization', `Bearer ${player2Token}`);
    await request(app)
      .post(`/api/activities/${activityId}/join`)
      .set('Authorization', `Bearer ${player3Token}`);

    // 将活动变为已结束
    await prisma.activity.update({
      where: { id: activityId },
      data: {
        startTime: pastDate(4),
        endTime: pastDate(2),
        status: 'completed',
      },
    });

    // 录入双打战绩（含一个临时用户 guestName）
    const recordRes = await request(app)
      .post('/api/match-records')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        sourceType: 'activity',
        sourceId: activityId,
        matchType: 'doubles',
        players: {
          sideA: [{ userId: creator.id }, { userId: player2.id }],
          sideB: [{ userId: player3.id }, { guestName: '临时球友小张' }],
        },
        games: [
          { scoreA: 21, scoreB: 15 },
          { scoreA: 21, scoreB: 19 },
        ],
      });

    expect(recordRes.status).toBe(201);
    expect(recordRes.body.data.matchType).toBe('doubles');
    expect(recordRes.body.data.players.sideA).toHaveLength(2);
    expect(recordRes.body.data.players.sideB).toHaveLength(2);
    expect(recordRes.body.data.result).toBe('A_WIN');

    // 验证临时用户（guestName）被正确创建
    const sideB = recordRes.body.data.players.sideB;
    const guestPlayer = sideB.find(
      (p: { guestId?: string; nickname: string }) => p.guestId !== undefined,
    );
    expect(guestPlayer).toBeDefined();
    expect(guestPlayer.nickname).toBe('临时球友小张');

    // 查看活动战绩列表
    const listRes = await request(app)
      .get(`/api/activities/${activityId}/match-records`)
      .set('Authorization', `Bearer ${creatorToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.items).toHaveLength(1);
    expect(listRes.body.data.items[0].matchType).toBe('doubles');

    // 验证个人战绩历史（按来源筛选）
    const historyRes = await request(app)
      .get(`/api/users/${creator.id}/match-records?sourceType=activity`)
      .set('Authorization', `Bearer ${creatorToken}`);

    expect(historyRes.status).toBe(200);
    expect(historyRes.body.data.items).toHaveLength(1);
    expect(historyRes.body.data.items[0].sourceType).toBe('activity');
  });

  it('多场战绩录入后统计正确更新', async () => {
    // 准备数据
    const playerA = await createTestUser({ nickname: '甲' });
    const playerB = await createTestUser({ nickname: '乙' });
    const city = await createTestCity({ name: '广州' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-l2-3' });

    const tokenA = signToken(playerA.id);
    const tokenB = signToken(playerB.id);

    // 创建活动并让 playerB 加入
    const createRes = await request(app)
      .post('/api/activities')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        venueId: venue.id,
        startTime: futureDate(2).toISOString(),
        endTime: futureDate(4).toISOString(),
        maxParticipants: 4,
      });
    const activityId = createRes.body.data.id;

    await request(app)
      .post(`/api/activities/${activityId}/join`)
      .set('Authorization', `Bearer ${tokenB}`);

    // 将活动设为已结束
    await prisma.activity.update({
      where: { id: activityId },
      data: {
        startTime: pastDate(4),
        endTime: pastDate(2),
        status: 'completed',
      },
    });

    // 录入第一场: A 赢
    await request(app)
      .post('/api/match-records')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        sourceType: 'activity',
        sourceId: activityId,
        matchType: 'singles',
        players: {
          sideA: [{ userId: playerA.id }],
          sideB: [{ userId: playerB.id }],
        },
        games: [{ scoreA: 21, scoreB: 15 }],
      });

    // 录入第二场: B 赢
    await request(app)
      .post('/api/match-records')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        sourceType: 'activity',
        sourceId: activityId,
        matchType: 'singles',
        players: {
          sideA: [{ userId: playerA.id }],
          sideB: [{ userId: playerB.id }],
        },
        games: [{ scoreA: 10, scoreB: 21 }],
      });

    // 录入第三场: 平局
    await request(app)
      .post('/api/match-records')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        sourceType: 'activity',
        sourceId: activityId,
        matchType: 'singles',
        players: {
          sideA: [{ userId: playerA.id }],
          sideB: [{ userId: playerB.id }],
        },
        games: [
          { scoreA: 21, scoreB: 18 },
          { scoreA: 15, scoreB: 21 },
        ],
      });

    // 验证活动战绩列表有3条
    const listRes = await request(app)
      .get(`/api/activities/${activityId}/match-records`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.items).toHaveLength(3);

    // 验证 playerA 的统计: 1 胜 1 负 1 平局
    const statsA = await request(app)
      .get(`/api/users/${playerA.id}/match-stats`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(statsA.status).toBe(200);
    expect(statsA.body.data.totalMatches).toBe(3);
    expect(statsA.body.data.wins).toBe(1);
    expect(statsA.body.data.losses).toBe(1);
    expect(statsA.body.data.draws).toBe(1);
    // winRate = wins / (wins + losses) = 1/2 = 50%
    expect(statsA.body.data.winRate).toBe(50);

    // 验证 playerB 的统计: 1 胜 1 负 1 平局
    const statsB = await request(app)
      .get(`/api/users/${playerB.id}/match-stats`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(statsB.status).toBe(200);
    expect(statsB.body.data.totalMatches).toBe(3);
    expect(statsB.body.data.wins).toBe(1);
    expect(statsB.body.data.losses).toBe(1);
    expect(statsB.body.data.draws).toBe(1);
  });

  it('删除战绩后统计正确更新', async () => {
    // 准备数据
    const playerA = await createTestUser({ nickname: '甲方' });
    const playerB = await createTestUser({ nickname: '乙方' });
    const city = await createTestCity({ name: '深圳' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-l2-4' });

    const tokenA = signToken(playerA.id);

    // 创建已结束活动
    const createRes = await request(app)
      .post('/api/activities')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        venueId: venue.id,
        startTime: futureDate(2).toISOString(),
        endTime: futureDate(4).toISOString(),
        maxParticipants: 4,
      });
    const activityId = createRes.body.data.id;

    await request(app)
      .post(`/api/activities/${activityId}/join`)
      .set('Authorization', `Bearer ${signToken(playerB.id)}`);

    await prisma.activity.update({
      where: { id: activityId },
      data: {
        startTime: pastDate(4),
        endTime: pastDate(2),
        status: 'completed',
      },
    });

    // 录入战绩
    const recordRes = await request(app)
      .post('/api/match-records')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        sourceType: 'activity',
        sourceId: activityId,
        matchType: 'singles',
        players: {
          sideA: [{ userId: playerA.id }],
          sideB: [{ userId: playerB.id }],
        },
        games: [{ scoreA: 21, scoreB: 15 }],
      });

    const matchRecordId = recordRes.body.data.id;

    // 确认统计有数据
    const statsBeforeRes = await request(app)
      .get(`/api/users/${playerA.id}/match-stats`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(statsBeforeRes.body.data.totalMatches).toBe(1);

    // 删除战绩
    const deleteRes = await request(app)
      .delete(`/api/match-records/${matchRecordId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(deleteRes.status).toBe(200);

    // 确认统计归零（实时计算）
    const statsAfterRes = await request(app)
      .get(`/api/users/${playerA.id}/match-stats`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(statsAfterRes.body.data.totalMatches).toBe(0);
    expect(statsAfterRes.body.data.wins).toBe(0);

    // 确认活动战绩列表为空
    const listRes = await request(app)
      .get(`/api/activities/${activityId}/match-records`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(listRes.body.data.items).toHaveLength(0);
  });
});

// =============================================================================
// 关键异常流程
// =============================================================================

describe('关键异常流程: 活动未结束时不能录入战绩', () => {
  it('活动状态为 open 时，录入战绩应返回 409 MATCH_RECORD_SOURCE_NOT_COMPLETED', async () => {
    const creator = await createTestUser({ nickname: '发起人' });
    const joiner = await createTestUser({ nickname: '参与者' });
    const city = await createTestCity({ name: '成都' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-l2-err-1' });

    const creatorToken = signToken(creator.id);
    const joinerToken = signToken(joiner.id);

    // 创建活动（状态 open）
    const createRes = await request(app)
      .post('/api/activities')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        venueId: venue.id,
        startTime: futureDate(2).toISOString(),
        endTime: futureDate(4).toISOString(),
        maxParticipants: 4,
      });
    const activityId = createRes.body.data.id;

    // joiner 加入活动
    await request(app)
      .post(`/api/activities/${activityId}/join`)
      .set('Authorization', `Bearer ${joinerToken}`);

    // 尝试在活动未结束时录入战绩
    const recordRes = await request(app)
      .post('/api/match-records')
      .set('Authorization', `Bearer ${joinerToken}`)
      .send({
        sourceType: 'activity',
        sourceId: activityId,
        matchType: 'singles',
        players: {
          sideA: [{ userId: creator.id }],
          sideB: [{ userId: joiner.id }],
        },
        games: [{ scoreA: 21, scoreB: 15 }],
      });

    expect(recordRes.status).toBe(409);
    expect(recordRes.body.error.code).toBe('MATCH_RECORD_SOURCE_NOT_COMPLETED');
  });

  it('活动状态为 in_progress 时，录入战绩应返回 409', async () => {
    const creator = await createTestUser({ nickname: '发起人B' });
    const joiner = await createTestUser({ nickname: '参与者B' });
    const city = await createTestCity({ name: '武汉' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-l2-err-2' });

    const creatorToken = signToken(creator.id);
    const joinerToken = signToken(joiner.id);

    const createRes = await request(app)
      .post('/api/activities')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        venueId: venue.id,
        startTime: futureDate(2).toISOString(),
        endTime: futureDate(4).toISOString(),
        maxParticipants: 4,
      });
    const activityId = createRes.body.data.id;

    await request(app)
      .post(`/api/activities/${activityId}/join`)
      .set('Authorization', `Bearer ${joinerToken}`);

    // 手动设置状态为 in_progress
    await prisma.activity.update({
      where: { id: activityId },
      data: {
        startTime: pastDate(2),
        endTime: futureDate(2),
        status: 'in_progress',
      },
    });

    const recordRes = await request(app)
      .post('/api/match-records')
      .set('Authorization', `Bearer ${joinerToken}`)
      .send({
        sourceType: 'activity',
        sourceId: activityId,
        matchType: 'singles',
        players: {
          sideA: [{ userId: creator.id }],
          sideB: [{ userId: joiner.id }],
        },
        games: [{ scoreA: 21, scoreB: 15 }],
      });

    expect(recordRes.status).toBe(409);
    expect(recordRes.body.error.code).toBe('MATCH_RECORD_SOURCE_NOT_COMPLETED');
  });

  it('活动状态为 cancelled 时，录入战绩应返回 409', async () => {
    const creator = await createTestUser({ nickname: '发起人C' });
    const joiner = await createTestUser({ nickname: '参与者C' });
    const city = await createTestCity({ name: '杭州' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-l2-err-3' });

    const creatorToken = signToken(creator.id);
    const joinerToken = signToken(joiner.id);

    const createRes = await request(app)
      .post('/api/activities')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        venueId: venue.id,
        startTime: futureDate(2).toISOString(),
        endTime: futureDate(4).toISOString(),
        maxParticipants: 4,
      });
    const activityId = createRes.body.data.id;

    await request(app)
      .post(`/api/activities/${activityId}/join`)
      .set('Authorization', `Bearer ${joinerToken}`);

    // 取消活动
    await request(app)
      .post(`/api/activities/${activityId}/cancel`)
      .set('Authorization', `Bearer ${creatorToken}`);

    const recordRes = await request(app)
      .post('/api/match-records')
      .set('Authorization', `Bearer ${joinerToken}`)
      .send({
        sourceType: 'activity',
        sourceId: activityId,
        matchType: 'singles',
        players: {
          sideA: [{ userId: creator.id }],
          sideB: [{ userId: joiner.id }],
        },
        games: [{ scoreA: 21, scoreB: 15 }],
      });

    expect(recordRes.status).toBe(409);
    expect(recordRes.body.error.code).toBe('MATCH_RECORD_SOURCE_NOT_COMPLETED');
  });
});

describe('关键异常流程: 非参与者不可录入战绩', () => {
  it('非活动参与者录入战绩应返回 403 MATCH_RECORD_NOT_PARTICIPANT', async () => {
    const creator = await createTestUser({ nickname: '活动创建者' });
    const participant = await createTestUser({ nickname: '参与者' });
    const outsider = await createTestUser({ nickname: '外部用户' });
    const city = await createTestCity({ name: '南京' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-l2-err-4' });

    const creatorToken = signToken(creator.id);
    const participantToken = signToken(participant.id);
    const outsiderToken = signToken(outsider.id);

    // 创建活动
    const createRes = await request(app)
      .post('/api/activities')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        venueId: venue.id,
        startTime: futureDate(2).toISOString(),
        endTime: futureDate(4).toISOString(),
        maxParticipants: 4,
      });
    const activityId = createRes.body.data.id;

    // participant 加入
    await request(app)
      .post(`/api/activities/${activityId}/join`)
      .set('Authorization', `Bearer ${participantToken}`);

    // 设为已结束
    await prisma.activity.update({
      where: { id: activityId },
      data: {
        startTime: pastDate(4),
        endTime: pastDate(2),
        status: 'completed',
      },
    });

    // outsider 尝试录入战绩（他不是参与者）
    const recordRes = await request(app)
      .post('/api/match-records')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({
        sourceType: 'activity',
        sourceId: activityId,
        matchType: 'singles',
        players: {
          sideA: [{ userId: creator.id }],
          sideB: [{ userId: participant.id }],
        },
        games: [{ scoreA: 21, scoreB: 15 }],
      });

    expect(recordRes.status).toBe(403);
    expect(recordRes.body.error.code).toBe('MATCH_RECORD_NOT_PARTICIPANT');
  });

  it('选手中包含非参与者应返回 403 MATCH_RECORD_PLAYER_NOT_PARTICIPANT', async () => {
    const creator = await createTestUser({ nickname: '活动创建者D' });
    const outsider = await createTestUser({ nickname: '外部选手D' });
    const city = await createTestCity({ name: '长沙' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-l2-err-5' });

    const creatorToken = signToken(creator.id);

    const createRes = await request(app)
      .post('/api/activities')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        venueId: venue.id,
        startTime: futureDate(2).toISOString(),
        endTime: futureDate(4).toISOString(),
        maxParticipants: 4,
      });
    const activityId = createRes.body.data.id;

    // 设为已结束
    await prisma.activity.update({
      where: { id: activityId },
      data: {
        startTime: pastDate(4),
        endTime: pastDate(2),
        status: 'completed',
      },
    });

    // 录入战绩：sideB 中的 outsider 不是活动参与者
    const recordRes = await request(app)
      .post('/api/match-records')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        sourceType: 'activity',
        sourceId: activityId,
        matchType: 'singles',
        players: {
          sideA: [{ userId: creator.id }],
          sideB: [{ userId: outsider.id }], // outsider is NOT a participant
        },
        games: [{ scoreA: 21, scoreB: 15 }],
      });

    expect(recordRes.status).toBe(403);
    expect(recordRes.body.error.code).toBe('MATCH_RECORD_PLAYER_NOT_PARTICIPANT');
  });
});

describe('关键异常流程: 不存在的活动', () => {
  it('来源活动不存在时应返回 404 MATCH_RECORD_SOURCE_NOT_FOUND', async () => {
    const user = await createTestUser({ nickname: '测试用户' });
    const token = signToken(user.id);

    const fakeActivityId = '00000000-0000-0000-0000-000000000999';

    const recordRes = await request(app)
      .post('/api/match-records')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceType: 'activity',
        sourceId: fakeActivityId,
        matchType: 'singles',
        players: {
          sideA: [{ userId: user.id }],
          sideB: [{ guestName: '临时' }],
        },
        games: [{ scoreA: 21, scoreB: 15 }],
      });

    expect(recordRes.status).toBe(404);
    expect(recordRes.body.error.code).toBe('MATCH_RECORD_SOURCE_NOT_FOUND');
  });
});

describe('关键异常流程: 非录入者不可删除战绩', () => {
  it('非录入者删除战绩应返回 403 MATCH_RECORD_NOT_RECORDER', async () => {
    const recorder = await createTestUser({ nickname: '录入者' });
    const otherUser = await createTestUser({ nickname: '其他人' });
    const city = await createTestCity({ name: '重庆' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-l2-err-6' });

    const recorderToken = signToken(recorder.id);
    const otherToken = signToken(otherUser.id);

    // 创建已结束活动
    const createRes = await request(app)
      .post('/api/activities')
      .set('Authorization', `Bearer ${recorderToken}`)
      .send({
        venueId: venue.id,
        startTime: futureDate(2).toISOString(),
        endTime: futureDate(4).toISOString(),
        maxParticipants: 4,
      });
    const activityId = createRes.body.data.id;

    await request(app)
      .post(`/api/activities/${activityId}/join`)
      .set('Authorization', `Bearer ${otherToken}`);

    await prisma.activity.update({
      where: { id: activityId },
      data: {
        startTime: pastDate(4),
        endTime: pastDate(2),
        status: 'completed',
      },
    });

    // recorder 录入战绩
    const recordRes = await request(app)
      .post('/api/match-records')
      .set('Authorization', `Bearer ${recorderToken}`)
      .send({
        sourceType: 'activity',
        sourceId: activityId,
        matchType: 'singles',
        players: {
          sideA: [{ userId: recorder.id }],
          sideB: [{ userId: otherUser.id }],
        },
        games: [{ scoreA: 21, scoreB: 15 }],
      });

    const matchRecordId = recordRes.body.data.id;

    // otherUser 尝试删除（不是录入者）
    const deleteRes = await request(app)
      .delete(`/api/match-records/${matchRecordId}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(deleteRes.status).toBe(403);
    expect(deleteRes.body.error.code).toBe('MATCH_RECORD_NOT_RECORDER');
  });
});

describe('关键异常流程: 活动满员状态联动', () => {
  it('活动满员后状态变为 full，退出后恢复 open', async () => {
    const creator = await createTestUser({ nickname: '满员测试创建者' });
    const joiner = await createTestUser({ nickname: '满员测试参与者' });
    const city = await createTestCity({ name: '天津' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-l2-full' });

    const creatorToken = signToken(creator.id);
    const joinerToken = signToken(joiner.id);

    // 创建 maxParticipants=2 的活动（creator 自动加入为第1人）
    const createRes = await request(app)
      .post('/api/activities')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        venueId: venue.id,
        startTime: futureDate(2).toISOString(),
        endTime: futureDate(4).toISOString(),
        maxParticipants: 2,
      });
    expect(createRes.body.data.status).toBe('open');
    const activityId = createRes.body.data.id;

    // joiner 加入后满员
    const joinRes = await request(app)
      .post(`/api/activities/${activityId}/join`)
      .set('Authorization', `Bearer ${joinerToken}`);
    expect(joinRes.body.data.status).toBe('full');
    expect(joinRes.body.data.currentParticipants).toBe(2);

    // 再有人加入应失败
    const thirdUser = await createTestUser({ nickname: '第三人' });
    const thirdRes = await request(app)
      .post(`/api/activities/${activityId}/join`)
      .set('Authorization', `Bearer ${signToken(thirdUser.id)}`);
    expect(thirdRes.status).toBe(409);
    expect(thirdRes.body.error.code).toBe('ACTIVITY_FULL');

    // joiner 退出，状态恢复 open
    const leaveRes = await request(app)
      .post(`/api/activities/${activityId}/leave`)
      .set('Authorization', `Bearer ${joinerToken}`);
    expect(leaveRes.body.data.status).toBe('open');
    expect(leaveRes.body.data.currentParticipants).toBe(1);
  });
});
