/**
 * L1 集成测试: match-record 模块 — 战绩录入与删除
 *
 * 测试层级: Controller -> Service -> Repository 真实串联
 * 数据库: 真实 PostgreSQL 测试库
 * Mock: 无（依赖的 user、venue、activity、coaching 模块均已实现）
 *
 * 覆盖接口:
 * - POST /api/match-records (录入战绩)
 * - DELETE /api/match-records/:id (删除战绩)
 * - GET /api/activities/:id/match-records (活动战绩列表)
 * - GET /api/group-classes/:id/match-records (团课战绩列表)
 * - GET /api/private-lessons/:id/match-records (私教课战绩列表)
 * - GET /api/users/:id/match-records (个人战绩历史)
 * - GET /api/users/:id/match-stats (个人战绩汇总)
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '@server/app.js';
import { config } from '@server/infra/config.js';
import { createTestUser } from '@tests/fixtures/user.js';
import { createTestCity, createTestVenue } from '@tests/fixtures/venue.js';
import { createTestActivity, addTestParticipant } from '@tests/fixtures/activity.js';
import {
  createTestGroupClass,
  createTestCoachProfile,
  addTestEnrollment,
  createTestPrivateLessonSlot,
  createTestPrivateLesson,
} from '@tests/fixtures/coaching.js';
import { createTestFullMatchRecord, getTestPrisma } from '@tests/fixtures/match-record.js';
import { resetTestDatabase } from '@tests/fixtures/database.js';

const prisma = getTestPrisma();

function signToken(userId: string): string {
  return jwt.sign({ userId, role: 'user' }, config.jwtSecret, { expiresIn: '7d' });
}

// Helper: create past dates for completed activities
function pastDate(hoursAgo: number): Date {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
}

async function cleanup() {
  await resetTestDatabase();
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

// ===========================================================================
// POST /api/match-records — 录入战绩
// ===========================================================================

describe('POST /api/match-records', () => {
  it('should create a singles match record for a completed activity', async () => {
    // Setup: create users, venue, completed activity, participants
    const recorder = await createTestUser({ nickname: '录入者' });
    const playerA = await createTestUser({ nickname: '张三' });
    const playerB = await createTestUser({ nickname: '李四' });
    const city = await createTestCity({ name: '北京' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-mr-1' });

    const activity = await createTestActivity({
      creatorId: recorder.id,
      venueId: venue.id,
      startTime: pastDate(4),
      endTime: pastDate(2),
      status: 'completed',
    });
    await addTestParticipant(activity.id, playerA.id);
    await addTestParticipant(activity.id, playerB.id);

    const token = signToken(recorder.id);

    const res = await request(app)
      .post('/api/match-records')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceType: 'activity',
        sourceId: activity.id,
        matchType: 'singles',
        players: {
          sideA: [{ userId: playerA.id }],
          sideB: [{ userId: playerB.id }],
        },
        games: [
          { scoreA: 21, scoreB: 18 },
          { scoreA: 21, scoreB: 15 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.sourceType).toBe('activity');
    expect(res.body.data.sourceId).toBe(activity.id);
    expect(res.body.data.matchType).toBe('singles');
    expect(res.body.data.recordedBy).toBe(recorder.id);
    expect(res.body.data.result).toBe('A_WIN');
    expect(res.body.data.players.sideA).toHaveLength(1);
    expect(res.body.data.players.sideB).toHaveLength(1);
    expect(res.body.data.players.sideA[0].nickname).toBe('张三');
    expect(res.body.data.players.sideB[0].nickname).toBe('李四');
    expect(res.body.data.games).toHaveLength(2);
    expect(res.body.data.games[0].gameNumber).toBe(1);
    expect(res.body.data.games[1].gameNumber).toBe(2);
    expect(res.body.data.recorder.id).toBe(recorder.id);
    expect(res.body.data.recorder.nickname).toBe('录入者');
  });

  it('should create a doubles match record for a completed group class', async () => {
    const coach = await createTestUser({ nickname: '教练A', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const p1 = await createTestUser({ nickname: '选手1' });
    const p2 = await createTestUser({ nickname: '选手2' });
    const p3 = await createTestUser({ nickname: '选手3' });
    const city = await createTestCity({ name: '上海' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-mr-gc-1' });

    const gc = await createTestGroupClass({
      coachId: coach.id,
      venueId: venue.id,
      startTime: pastDate(4),
      endTime: pastDate(2),
      status: 'completed',
    });
    await addTestEnrollment(gc.id, p1.id);
    await addTestEnrollment(gc.id, p2.id);
    await addTestEnrollment(gc.id, p3.id);

    const token = signToken(coach.id);

    const res = await request(app)
      .post('/api/match-records')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceType: 'group-class',
        sourceId: gc.id,
        matchType: 'doubles',
        players: {
          sideA: [{ userId: coach.id }, { userId: p1.id }],
          sideB: [{ userId: p2.id }, { userId: p3.id }],
        },
        games: [
          { scoreA: 21, scoreB: 19 },
          { scoreA: 18, scoreB: 21 },
          { scoreA: 21, scoreB: 17 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.sourceType).toBe('group-class');
    expect(res.body.data.matchType).toBe('doubles');
    expect(res.body.data.result).toBe('A_WIN');
    expect(res.body.data.players.sideA).toHaveLength(2);
    expect(res.body.data.players.sideB).toHaveLength(2);
  });

  it('should create match record with guest player (non-platform user)', async () => {
    const recorder = await createTestUser({ nickname: '录入者' });
    const playerA = await createTestUser({ nickname: '张三' });
    const city = await createTestCity({ name: '广州' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-mr-guest-1' });

    const activity = await createTestActivity({
      creatorId: recorder.id,
      venueId: venue.id,
      startTime: pastDate(4),
      endTime: pastDate(2),
      status: 'completed',
    });
    await addTestParticipant(activity.id, playerA.id);

    const token = signToken(recorder.id);

    const res = await request(app)
      .post('/api/match-records')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceType: 'activity',
        sourceId: activity.id,
        matchType: 'singles',
        players: {
          sideA: [{ userId: playerA.id }],
          sideB: [{ guestName: '临时球友A' }],
        },
        games: [{ scoreA: 21, scoreB: 15 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.players.sideB[0].guestId).toBeDefined();
    expect(res.body.data.players.sideB[0].nickname).toBe('临时球友A');

    // Verify GuestPlayer was created in database
    const guestPlayers = await prisma.guestPlayer.findMany({
      where: { nickname: '临时球友A' },
    });
    expect(guestPlayers.length).toBeGreaterThanOrEqual(1);
  });

  it('should create match record with private-lesson source', async () => {
    const coach = await createTestUser({ nickname: '教练B', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const student = await createTestUser({ nickname: '学生A' });

    const slot = await createTestPrivateLessonSlot({
      coachId: coach.id,
      startTime: pastDate(4),
      endTime: pastDate(2),
      isBooked: true,
    });
    const lesson = await createTestPrivateLesson({
      slotId: slot.id,
      coachId: coach.id,
      studentId: student.id,
      startTime: pastDate(4),
      endTime: pastDate(2),
      status: 'completed',
    });

    const token = signToken(coach.id);

    const res = await request(app)
      .post('/api/match-records')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceType: 'private-lesson',
        sourceId: lesson.id,
        matchType: 'singles',
        players: {
          sideA: [{ userId: coach.id }],
          sideB: [{ userId: student.id }],
        },
        games: [{ scoreA: 15, scoreB: 21 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.sourceType).toBe('private-lesson');
    expect(res.body.data.result).toBe('B_WIN');
  });

  it('should return 403 when recorder is not a participant', async () => {
    const creator = await createTestUser();
    const outsider = await createTestUser();
    const playerA = await createTestUser();
    const playerB = await createTestUser();
    const city = await createTestCity({ name: '深圳' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-mr-notp-1' });

    const activity = await createTestActivity({
      creatorId: creator.id,
      venueId: venue.id,
      startTime: pastDate(4),
      endTime: pastDate(2),
      status: 'completed',
    });
    await addTestParticipant(activity.id, playerA.id);
    await addTestParticipant(activity.id, playerB.id);

    const token = signToken(outsider.id);

    const res = await request(app)
      .post('/api/match-records')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceType: 'activity',
        sourceId: activity.id,
        matchType: 'singles',
        players: {
          sideA: [{ userId: playerA.id }],
          sideB: [{ userId: playerB.id }],
        },
        games: [{ scoreA: 21, scoreB: 18 }],
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('MATCH_RECORD_NOT_PARTICIPANT');
  });

  it('should return 403 when player userId is not a participant', async () => {
    const recorder = await createTestUser();
    const playerA = await createTestUser();
    const outsider = await createTestUser();
    const city = await createTestCity({ name: '南京' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-mr-pnp-1' });

    const activity = await createTestActivity({
      creatorId: recorder.id,
      venueId: venue.id,
      startTime: pastDate(4),
      endTime: pastDate(2),
      status: 'completed',
    });
    await addTestParticipant(activity.id, playerA.id);

    const token = signToken(recorder.id);

    const res = await request(app)
      .post('/api/match-records')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceType: 'activity',
        sourceId: activity.id,
        matchType: 'singles',
        players: {
          sideA: [{ userId: playerA.id }],
          sideB: [{ userId: outsider.id }],
        },
        games: [{ scoreA: 21, scoreB: 18 }],
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('MATCH_RECORD_PLAYER_NOT_PARTICIPANT');
  });

  it('should return 404 when source does not exist', async () => {
    const recorder = await createTestUser();
    const token = signToken(recorder.id);

    const res = await request(app)
      .post('/api/match-records')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceType: 'activity',
        sourceId: '00000000-0000-0000-0000-000000000000',
        matchType: 'singles',
        players: {
          sideA: [{ userId: recorder.id }],
          sideB: [{ guestName: '球友' }],
        },
        games: [{ scoreA: 21, scoreB: 18 }],
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('MATCH_RECORD_SOURCE_NOT_FOUND');
  });

  it('should return 409 when source is not completed', async () => {
    const recorder = await createTestUser();
    const playerB = await createTestUser();
    const city = await createTestCity({ name: '杭州' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-mr-nc-1' });

    const activity = await createTestActivity({
      creatorId: recorder.id,
      venueId: venue.id,
      status: 'open',
    });
    await addTestParticipant(activity.id, playerB.id);

    const token = signToken(recorder.id);

    const res = await request(app)
      .post('/api/match-records')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceType: 'activity',
        sourceId: activity.id,
        matchType: 'singles',
        players: {
          sideA: [{ userId: recorder.id }],
          sideB: [{ userId: playerB.id }],
        },
        games: [{ scoreA: 21, scoreB: 18 }],
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MATCH_RECORD_SOURCE_NOT_COMPLETED');
  });

  it('should return 400 for invalid score (both 0)', async () => {
    const recorder = await createTestUser();
    const playerB = await createTestUser();
    const city = await createTestCity({ name: '成都' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-mr-is-1' });

    const activity = await createTestActivity({
      creatorId: recorder.id,
      venueId: venue.id,
      startTime: pastDate(4),
      endTime: pastDate(2),
      status: 'completed',
    });
    await addTestParticipant(activity.id, playerB.id);

    const token = signToken(recorder.id);

    const res = await request(app)
      .post('/api/match-records')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceType: 'activity',
        sourceId: activity.id,
        matchType: 'singles',
        players: {
          sideA: [{ userId: recorder.id }],
          sideB: [{ userId: playerB.id }],
        },
        games: [{ scoreA: 0, scoreB: 0 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MATCH_RECORD_INVALID_SCORE');
  });

  it('should return 400 for duplicate player userId', async () => {
    const recorder = await createTestUser();
    const city = await createTestCity({ name: '武汉' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-mr-dup-1' });

    const activity = await createTestActivity({
      creatorId: recorder.id,
      venueId: venue.id,
      startTime: pastDate(4),
      endTime: pastDate(2),
      status: 'completed',
    });

    const token = signToken(recorder.id);

    const res = await request(app)
      .post('/api/match-records')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceType: 'activity',
        sourceId: activity.id,
        matchType: 'singles',
        players: {
          sideA: [{ userId: recorder.id }],
          sideB: [{ userId: recorder.id }],
        },
        games: [{ scoreA: 21, scoreB: 18 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MATCH_RECORD_DUPLICATE_PLAYER');
  });

  it('should return 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/match-records')
      .send({
        sourceType: 'activity',
        sourceId: '00000000-0000-0000-0000-000000000000',
        matchType: 'singles',
        players: { sideA: [{ guestName: 'A' }], sideB: [{ guestName: 'B' }] },
        games: [{ scoreA: 21, scoreB: 18 }],
      });

    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// DELETE /api/match-records/:id — 删除战绩
// ===========================================================================

describe('DELETE /api/match-records/:id', () => {
  it('should delete a match record when requested by recorder', async () => {
    const recorder = await createTestUser();
    const playerA = await createTestUser();
    const playerB = await createTestUser();
    const city = await createTestCity({ name: '厦门' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-mr-del-1' });

    const activity = await createTestActivity({
      creatorId: recorder.id,
      venueId: venue.id,
      startTime: pastDate(4),
      endTime: pastDate(2),
      status: 'completed',
    });
    await addTestParticipant(activity.id, playerA.id);
    await addTestParticipant(activity.id, playerB.id);

    // Create via API first
    const token = signToken(recorder.id);
    const createRes = await request(app)
      .post('/api/match-records')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceType: 'activity',
        sourceId: activity.id,
        matchType: 'singles',
        players: {
          sideA: [{ userId: playerA.id }],
          sideB: [{ userId: playerB.id }],
        },
        games: [{ scoreA: 21, scoreB: 18 }],
      });

    expect(createRes.status).toBe(201);
    const recordId = createRes.body.data.id;

    // Delete
    const delRes = await request(app)
      .delete(`/api/match-records/${recordId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(delRes.status).toBe(200);
    expect(delRes.body.data.id).toBe(recordId);

    // Verify cascade deletion — record no longer in DB
    const record = await prisma.matchRecord.findUnique({ where: { id: recordId } });
    expect(record).toBeNull();

    const players = await prisma.matchPlayer.findMany({ where: { matchRecordId: recordId } });
    expect(players).toHaveLength(0);

    const games = await prisma.matchGame.findMany({ where: { matchRecordId: recordId } });
    expect(games).toHaveLength(0);
  });

  it('should return 403 when non-recorder tries to delete', async () => {
    const recorder = await createTestUser();
    const otherUser = await createTestUser();
    const playerA = await createTestUser();
    const city = await createTestCity({ name: '济南' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-mr-del-forbid' });

    const activity = await createTestActivity({
      creatorId: recorder.id,
      venueId: venue.id,
      startTime: pastDate(4),
      endTime: pastDate(2),
      status: 'completed',
    });
    await addTestParticipant(activity.id, playerA.id);

    const recorderToken = signToken(recorder.id);
    const createRes = await request(app)
      .post('/api/match-records')
      .set('Authorization', `Bearer ${recorderToken}`)
      .send({
        sourceType: 'activity',
        sourceId: activity.id,
        matchType: 'singles',
        players: {
          sideA: [{ userId: recorder.id }],
          sideB: [{ userId: playerA.id }],
        },
        games: [{ scoreA: 21, scoreB: 18 }],
      });

    const recordId = createRes.body.data.id;
    const otherToken = signToken(otherUser.id);

    const delRes = await request(app)
      .delete(`/api/match-records/${recordId}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(delRes.status).toBe(403);
    expect(delRes.body.error.code).toBe('MATCH_RECORD_NOT_RECORDER');
  });

  it('should return 404 when record does not exist', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    const delRes = await request(app)
      .delete('/api/match-records/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(delRes.status).toBe(404);
    expect(delRes.body.error.code).toBe('MATCH_RECORD_NOT_FOUND');
  });
});

// ===========================================================================
// GET /api/activities/:id/match-records — 活动战绩列表
// ===========================================================================

describe('GET /api/activities/:id/match-records', () => {
  it('should return match records for a completed activity', async () => {
    const recorder = await createTestUser({ nickname: '录入者X' });
    const playerA = await createTestUser({ nickname: '甲' });
    const playerB = await createTestUser({ nickname: '乙' });
    const city = await createTestCity({ name: '重庆' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-mr-list-1' });

    const activity = await createTestActivity({
      creatorId: recorder.id,
      venueId: venue.id,
      startTime: pastDate(4),
      endTime: pastDate(2),
      status: 'completed',
    });
    await addTestParticipant(activity.id, playerA.id);
    await addTestParticipant(activity.id, playerB.id);

    // Create a record directly in DB
    await createTestFullMatchRecord({
      recordedBy: recorder.id,
      sourceType: 'activity',
      sourceId: activity.id,
      matchType: 'singles',
      players: [
        { side: 'A', userId: playerA.id },
        { side: 'B', userId: playerB.id },
      ],
      games: [
        { gameNumber: 1, scoreA: 21, scoreB: 18 },
        { gameNumber: 2, scoreA: 21, scoreB: 15 },
      ],
    });

    const token = signToken(recorder.id);

    const res = await request(app)
      .get(`/api/activities/${activity.id}/match-records`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);

    const item = res.body.data.items[0];
    expect(item.sourceType).toBe('activity');
    expect(item.sourceId).toBe(activity.id);
    expect(item.result).toBe('A_WIN');
    expect(item.players.sideA[0].nickname).toBe('甲');
    expect(item.players.sideB[0].nickname).toBe('乙');
    expect(item.recorder.nickname).toBe('录入者X');
    expect(item.games).toHaveLength(2);
  });

  it('should return empty items when activity has no match records', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    const res = await request(app)
      .get('/api/activities/00000000-0000-0000-0000-000000000000/match-records')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });
});

// ===========================================================================
// GET /api/users/:id/match-records — 个人战绩历史
// ===========================================================================

describe('GET /api/users/:id/match-records', () => {
  it('should return user match records with userResult', async () => {
    const recorder = await createTestUser();
    const playerA = await createTestUser({ nickname: '甲方' });
    const playerB = await createTestUser({ nickname: '乙方' });
    const city = await createTestCity({ name: '天津' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-mr-user-1' });

    const activity = await createTestActivity({
      creatorId: recorder.id,
      venueId: venue.id,
      startTime: pastDate(4),
      endTime: pastDate(2),
      status: 'completed',
    });
    await addTestParticipant(activity.id, playerA.id);
    await addTestParticipant(activity.id, playerB.id);

    // A wins
    await createTestFullMatchRecord({
      recordedBy: recorder.id,
      sourceType: 'activity',
      sourceId: activity.id,
      matchType: 'singles',
      players: [
        { side: 'A', userId: playerA.id },
        { side: 'B', userId: playerB.id },
      ],
      games: [
        { gameNumber: 1, scoreA: 21, scoreB: 18 },
        { gameNumber: 2, scoreA: 21, scoreB: 15 },
      ],
    });

    const token = signToken(playerA.id);

    const res = await request(app)
      .get(`/api/users/${playerA.id}/match-records`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].userResult).toBe('WIN');
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.pageSize).toBe(20);

    // Check from the losing side
    const tokenB = signToken(playerB.id);
    const resB = await request(app)
      .get(`/api/users/${playerB.id}/match-records`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(resB.body.data.items[0].userResult).toBe('LOSE');
  });

  it('should support pagination', async () => {
    const recorder = await createTestUser();
    const playerA = await createTestUser();
    const playerB = await createTestUser();
    const city = await createTestCity({ name: '长沙' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-mr-page-1' });

    const activity = await createTestActivity({
      creatorId: recorder.id,
      venueId: venue.id,
      startTime: pastDate(4),
      endTime: pastDate(2),
      status: 'completed',
    });
    await addTestParticipant(activity.id, playerA.id);
    await addTestParticipant(activity.id, playerB.id);

    // Create 3 records
    for (let i = 0; i < 3; i++) {
      await createTestFullMatchRecord({
        recordedBy: recorder.id,
        sourceType: 'activity',
        sourceId: activity.id,
        matchType: 'singles',
        players: [
          { side: 'A', userId: playerA.id },
          { side: 'B', userId: playerB.id },
        ],
        games: [{ gameNumber: 1, scoreA: 21, scoreB: 18 }],
      });
    }

    const token = signToken(playerA.id);

    const res = await request(app)
      .get(`/api/users/${playerA.id}/match-records?page=1&pageSize=2`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.total).toBe(3);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.pageSize).toBe(2);
  });

  it('should filter by sourceType when provided', async () => {
    const coach = await createTestUser({ nickname: '教练F', isCoach: true });
    await createTestCoachProfile({ userId: coach.id });
    const player = await createTestUser({ nickname: '选手F' });
    const city = await createTestCity({ name: '西安' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-mr-filter-1' });

    // Create a completed activity with player as participant
    const activity = await createTestActivity({
      creatorId: coach.id,
      venueId: venue.id,
      startTime: pastDate(6),
      endTime: pastDate(4),
      status: 'completed',
    });
    await addTestParticipant(activity.id, player.id);

    // Create a completed group class with player enrolled
    const gc = await createTestGroupClass({
      coachId: coach.id,
      venueId: venue.id,
      startTime: pastDate(4),
      endTime: pastDate(2),
      status: 'completed',
    });
    await addTestEnrollment(gc.id, player.id);

    // Create activity record
    await createTestFullMatchRecord({
      recordedBy: coach.id,
      sourceType: 'activity',
      sourceId: activity.id,
      matchType: 'singles',
      players: [
        { side: 'A', userId: coach.id },
        { side: 'B', userId: player.id },
      ],
      games: [{ gameNumber: 1, scoreA: 21, scoreB: 18 }],
    });

    // Create group-class record
    await createTestFullMatchRecord({
      recordedBy: coach.id,
      sourceType: 'group-class',
      sourceId: gc.id,
      matchType: 'singles',
      players: [
        { side: 'A', userId: coach.id },
        { side: 'B', userId: player.id },
      ],
      games: [{ gameNumber: 1, scoreA: 15, scoreB: 21 }],
    });

    const token = signToken(player.id);

    // Without filter: both records
    const resAll = await request(app)
      .get(`/api/users/${player.id}/match-records`)
      .set('Authorization', `Bearer ${token}`);
    expect(resAll.status).toBe(200);
    expect(resAll.body.data.items).toHaveLength(2);
    expect(resAll.body.data.total).toBe(2);

    // With sourceType=activity: only activity record
    const resActivity = await request(app)
      .get(`/api/users/${player.id}/match-records?sourceType=activity`)
      .set('Authorization', `Bearer ${token}`);
    expect(resActivity.status).toBe(200);
    expect(resActivity.body.data.items).toHaveLength(1);
    expect(resActivity.body.data.items[0].sourceType).toBe('activity');
    expect(resActivity.body.data.total).toBe(1);

    // With sourceType=group-class: only group-class record
    const resGC = await request(app)
      .get(`/api/users/${player.id}/match-records?sourceType=group-class`)
      .set('Authorization', `Bearer ${token}`);
    expect(resGC.status).toBe(200);
    expect(resGC.body.data.items).toHaveLength(1);
    expect(resGC.body.data.items[0].sourceType).toBe('group-class');
    expect(resGC.body.data.total).toBe(1);
  });
});

// ===========================================================================
// GET /api/users/:id/match-stats — 个人战绩汇总
// ===========================================================================

describe('GET /api/users/:id/match-stats', () => {
  it('should return correct stats for a user with match records', async () => {
    const recorder = await createTestUser();
    const playerA = await createTestUser();
    const playerB = await createTestUser();
    const city = await createTestCity({ name: '福州' });
    const venue = await createTestVenue({ cityId: city.id, mapPoiId: 'poi-mr-stats-1' });

    const activity = await createTestActivity({
      creatorId: recorder.id,
      venueId: venue.id,
      startTime: pastDate(4),
      endTime: pastDate(2),
      status: 'completed',
    });
    await addTestParticipant(activity.id, playerA.id);
    await addTestParticipant(activity.id, playerB.id);

    // Win: A wins 2-0
    await createTestFullMatchRecord({
      recordedBy: recorder.id,
      sourceType: 'activity',
      sourceId: activity.id,
      matchType: 'singles',
      players: [
        { side: 'A', userId: playerA.id },
        { side: 'B', userId: playerB.id },
      ],
      games: [
        { gameNumber: 1, scoreA: 21, scoreB: 18 },
        { gameNumber: 2, scoreA: 21, scoreB: 15 },
      ],
    });

    // Loss: B wins 2-1
    await createTestFullMatchRecord({
      recordedBy: recorder.id,
      sourceType: 'activity',
      sourceId: activity.id,
      matchType: 'singles',
      players: [
        { side: 'A', userId: playerA.id },
        { side: 'B', userId: playerB.id },
      ],
      games: [
        { gameNumber: 1, scoreA: 21, scoreB: 18 },
        { gameNumber: 2, scoreA: 18, scoreB: 21 },
        { gameNumber: 3, scoreA: 15, scoreB: 21 },
      ],
    });

    // Draw: 1-1
    await createTestFullMatchRecord({
      recordedBy: recorder.id,
      sourceType: 'activity',
      sourceId: activity.id,
      matchType: 'singles',
      players: [
        { side: 'A', userId: playerA.id },
        { side: 'B', userId: playerB.id },
      ],
      games: [
        { gameNumber: 1, scoreA: 21, scoreB: 18 },
        { gameNumber: 2, scoreA: 18, scoreB: 21 },
      ],
    });

    const token = signToken(playerA.id);

    const res = await request(app)
      .get(`/api/users/${playerA.id}/match-stats`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalMatches).toBe(3);
    expect(res.body.data.wins).toBe(1);
    expect(res.body.data.losses).toBe(1);
    expect(res.body.data.draws).toBe(1);
    // winRate = 1 / (1 + 1) * 100 = 50.0
    expect(res.body.data.winRate).toBe(50);
  });

  it('should return all-zero stats when user has no match records', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    const res = await request(app)
      .get(`/api/users/${user.id}/match-stats`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalMatches).toBe(0);
    expect(res.body.data.wins).toBe(0);
    expect(res.body.data.losses).toBe(0);
    expect(res.body.data.draws).toBe(0);
    expect(res.body.data.winRate).toBe(0);
  });
});
