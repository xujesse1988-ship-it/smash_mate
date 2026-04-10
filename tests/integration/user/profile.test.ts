/**
 * L1 集成测试: user 模块 — 用户资料管理与教练角色开启
 *
 * 测试层级: Controller → Service → Repository 真实串联
 * 数据库: 真实 PostgreSQL 测试库
 * Mock: 无（user 为基础层，不依赖其他业务模块）
 *
 * 覆盖接口:
 * - PUT /api/users/me (更新个人资料)
 * - PUT /api/users/me/coach-role (开启教练角色)
 * - GET /api/users/:id (获取用户公开信息)
 * - UserService.getUserById (跨模块 Service 调用)
 * - UserService.getUsersByIds (跨模块 Service 调用)
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '@server/app.js';
import { config } from '@server/infra/config.js';
import { UserService } from '@server/modules/user/service.js';
import { UserRepository } from '@server/modules/user/repository.js';
import { createTestUser, getTestPrisma } from '@tests/fixtures/user.js';
import { resetTestDatabase } from '@tests/fixtures/database.js';

const prisma = getTestPrisma();

/**
 * Helper: create a JWT token for a given user ID
 */
function signToken(userId: string): string {
  return jwt.sign({ userId, role: 'user' }, config.jwtSecret, {
    expiresIn: '7d',
  });
}

beforeAll(async () => {
  await resetTestDatabase();
});

afterEach(async () => {
  await resetTestDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ===========================================================================
// PUT /api/users/me — 更新个人资料
// ===========================================================================

describe('PUT /api/users/me', () => {
  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  it('should update nickname', async () => {
    const user = await createTestUser({ nickname: '原昵称' });
    const token = signToken(user.id);

    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ nickname: '新昵称' });

    expect(res.status).toBe(200);
    expect(res.body.data.nickname).toBe('新昵称');
    expect(res.body.data.id).toBe(user.id);

    // Verify in database
    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated!.nickname).toBe('新昵称');
  });

  it('should update avatarUrl', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);
    const newUrl = 'https://cdn.example.com/new-avatar.png';

    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ avatarUrl: newUrl });

    expect(res.status).toBe(200);
    expect(res.body.data.avatarUrl).toBe(newUrl);

    // Verify in database
    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated!.avatarUrl).toBe(newUrl);
  });

  it('should update bio', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: '新的个人简介' });

    expect(res.status).toBe(200);
    expect(res.body.data.bio).toBe('新的个人简介');

    // Verify in database
    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated!.bio).toBe('新的个人简介');
  });

  it('should update multiple fields at once', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nickname: '多字段昵称',
        bio: '多字段简介',
        avatarUrl: 'https://example.com/multi.jpg',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.nickname).toBe('多字段昵称');
    expect(res.body.data.bio).toBe('多字段简介');
    expect(res.body.data.avatarUrl).toBe('https://example.com/multi.jpg');
  });

  it('should preserve unchanged fields when only some fields are provided', async () => {
    const user = await createTestUser({
      nickname: '原昵称',
      bio: '原简介',
      avatarUrl: 'https://example.com/original.jpg',
    });
    const token = signToken(user.id);

    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ nickname: '新昵称' });

    expect(res.status).toBe(200);
    expect(res.body.data.nickname).toBe('新昵称');
    // bio and avatarUrl should remain unchanged
    expect(res.body.data.bio).toBe('原简介');
    expect(res.body.data.avatarUrl).toBe('https://example.com/original.jpg');
  });

  it('should mask phone number in response', async () => {
    const user = await createTestUser({ phone: '13812345678' });
    const token = signToken(user.id);

    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ nickname: '测试脱敏' });

    expect(res.status).toBe(200);
    expect(res.body.data.phone).toBe('138****5678');
  });

  it('should return complete user fields in response', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ nickname: '新昵称' });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('phone');
    expect(res.body.data).toHaveProperty('nickname');
    expect(res.body.data).toHaveProperty('avatarUrl');
    expect(res.body.data).toHaveProperty('bio');
    expect(res.body.data).toHaveProperty('isCoach');
    expect(res.body.data).toHaveProperty('createdAt');
  });

  it('should accept nickname at boundary (2 characters)', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ nickname: '好的' });

    expect(res.status).toBe(200);
    expect(res.body.data.nickname).toBe('好的');
  });

  it('should accept nickname at boundary (20 characters)', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);
    const longNickname = '一二三四五六七八九十一二三四五六七八九十'; // 20 chars

    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ nickname: longNickname });

    expect(res.status).toBe(200);
    expect(res.body.data.nickname).toBe(longNickname);
  });

  it('should accept bio at boundary (200 characters)', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);
    const longBio = '字'.repeat(200);

    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: longBio });

    expect(res.status).toBe(200);
    expect(res.body.data.bio).toBe(longBio);
  });

  it('should accept avatarUrl with http://', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ avatarUrl: 'http://example.com/avatar.jpg' });

    expect(res.status).toBe(200);
    expect(res.body.data.avatarUrl).toBe('http://example.com/avatar.jpg');
  });

  // -----------------------------------------------------------------------
  // 异常流程 — 参数校验
  // -----------------------------------------------------------------------

  it('should reject empty nickname', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ nickname: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('USER_INVALID_NICKNAME');
  });

  it('should reject nickname shorter than 2 characters', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ nickname: '好' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('USER_INVALID_NICKNAME');
  });

  it('should reject nickname longer than 20 characters', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);
    const longNickname = '一二三四五六七八九十一二三四五六七八九十多'; // 21 chars

    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ nickname: longNickname });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('USER_INVALID_NICKNAME');
  });

  it('should reject bio longer than 200 characters', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);
    const longBio = '字'.repeat(201);

    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: longBio });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('USER_INVALID_BIO');
  });

  it('should reject avatarUrl without http/https protocol', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ avatarUrl: 'ftp://example.com/avatar.jpg' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('USER_INVALID_AVATAR_URL');
  });

  it('should reject avatarUrl that is a plain string', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ avatarUrl: 'not-a-url' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('USER_INVALID_AVATAR_URL');
  });

  it('should reject empty avatarUrl string', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ avatarUrl: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('USER_INVALID_AVATAR_URL');
  });

  // -----------------------------------------------------------------------
  // 认证
  // -----------------------------------------------------------------------

  it('should reject request without token', async () => {
    const res = await request(app).put('/api/users/me').send({ nickname: '新昵称' });

    expect(res.status).toBe(401);
  });

  it('should reject request with invalid token', async () => {
    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', 'Bearer invalid-token')
      .send({ nickname: '新昵称' });

    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// PUT /api/users/me/coach-role — 开启教练角色
// ===========================================================================

describe('PUT /api/users/me/coach-role', () => {
  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  it('should enable coach role for a non-coach user', async () => {
    const user = await createTestUser({ isCoach: false });
    const token = signToken(user.id);

    const res = await request(app)
      .put('/api/users/me/coach-role')
      .set('Authorization', `Bearer ${token}`)
      .send({ isCoach: true });

    expect(res.status).toBe(200);
    expect(res.body.data.isCoach).toBe(true);
    expect(res.body.data.id).toBe(user.id);

    // Verify in database
    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated!.isCoach).toBe(true);
  });

  it('should be idempotent — already a coach returns success', async () => {
    const user = await createTestUser({ isCoach: true });
    const token = signToken(user.id);

    const res = await request(app)
      .put('/api/users/me/coach-role')
      .set('Authorization', `Bearer ${token}`)
      .send({ isCoach: true });

    expect(res.status).toBe(200);
    expect(res.body.data.isCoach).toBe(true);
    expect(res.body.data.id).toBe(user.id);
  });

  it('should mask phone number in response', async () => {
    const user = await createTestUser({ phone: '13812345678', isCoach: false });
    const token = signToken(user.id);

    const res = await request(app)
      .put('/api/users/me/coach-role')
      .set('Authorization', `Bearer ${token}`)
      .send({ isCoach: true });

    expect(res.status).toBe(200);
    expect(res.body.data.phone).toBe('138****5678');
  });

  it('should return complete user fields in response', async () => {
    const user = await createTestUser({ isCoach: false });
    const token = signToken(user.id);

    const res = await request(app)
      .put('/api/users/me/coach-role')
      .set('Authorization', `Bearer ${token}`)
      .send({ isCoach: true });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('phone');
    expect(res.body.data).toHaveProperty('nickname');
    expect(res.body.data).toHaveProperty('avatarUrl');
    expect(res.body.data).toHaveProperty('bio');
    expect(res.body.data).toHaveProperty('isCoach');
    expect(res.body.data).toHaveProperty('createdAt');
  });

  // -----------------------------------------------------------------------
  // 异常流程
  // -----------------------------------------------------------------------

  it('should reject isCoach = false (closing coach role not supported)', async () => {
    const user = await createTestUser({ isCoach: true });
    const token = signToken(user.id);

    const res = await request(app)
      .put('/api/users/me/coach-role')
      .set('Authorization', `Bearer ${token}`)
      .send({ isCoach: false });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('USER_COACH_ROLE_CLOSE_NOT_SUPPORTED');
  });

  it('should reject when isCoach field is missing', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    const res = await request(app)
      .put('/api/users/me/coach-role')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('USER_INVALID_COACH_ROLE');
  });

  it('should reject when isCoach is a string', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    const res = await request(app)
      .put('/api/users/me/coach-role')
      .set('Authorization', `Bearer ${token}`)
      .send({ isCoach: 'true' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('USER_INVALID_COACH_ROLE');
  });

  it('should reject when isCoach is a number', async () => {
    const user = await createTestUser();
    const token = signToken(user.id);

    const res = await request(app)
      .put('/api/users/me/coach-role')
      .set('Authorization', `Bearer ${token}`)
      .send({ isCoach: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('USER_INVALID_COACH_ROLE');
  });

  // -----------------------------------------------------------------------
  // 认证
  // -----------------------------------------------------------------------

  it('should reject request without token', async () => {
    const res = await request(app).put('/api/users/me/coach-role').send({ isCoach: true });

    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// GET /api/users/:id — 获取用户公开信息
// ===========================================================================

describe('GET /api/users/:id', () => {
  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  it('should return public info for an existing user', async () => {
    const targetUser = await createTestUser({
      nickname: '被查看用户',
      bio: '球友简介',
      avatarUrl: 'https://example.com/avatar.jpg',
      isCoach: false,
    });
    const viewer = await createTestUser();
    const token = signToken(viewer.id);

    const res = await request(app)
      .get(`/api/users/${targetUser.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(targetUser.id);
    expect(res.body.data.nickname).toBe('被查看用户');
    expect(res.body.data.bio).toBe('球友简介');
    expect(res.body.data.avatarUrl).toBe('https://example.com/avatar.jpg');
    expect(res.body.data.isCoach).toBe(false);
    expect(res.body.data).toHaveProperty('createdAt');
  });

  it('should NOT include phone field in public info (privacy protection)', async () => {
    const targetUser = await createTestUser({ phone: '13812345678' });
    const viewer = await createTestUser();
    const token = signToken(viewer.id);

    const res = await request(app)
      .get(`/api/users/${targetUser.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty('phone');
  });

  it('should return public info for a coach user', async () => {
    const coachUser = await createTestUser({ isCoach: true });
    const viewer = await createTestUser();
    const token = signToken(viewer.id);

    const res = await request(app)
      .get(`/api/users/${coachUser.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.isCoach).toBe(true);
  });

  it('should allow viewing own public info', async () => {
    const user = await createTestUser({ nickname: '自己查自己' });
    const token = signToken(user.id);

    const res = await request(app)
      .get(`/api/users/${user.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(user.id);
    expect(res.body.data.nickname).toBe('自己查自己');
  });

  // -----------------------------------------------------------------------
  // 异常流程
  // -----------------------------------------------------------------------

  it('should return 404 for non-existent user', async () => {
    const viewer = await createTestUser();
    const token = signToken(viewer.id);

    const res = await request(app)
      .get('/api/users/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
  });

  it('should reject request without token', async () => {
    const targetUser = await createTestUser();

    const res = await request(app).get(`/api/users/${targetUser.id}`);

    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// 跨模块 Service 调用 — UserService.getUserById / getUsersByIds
// ===========================================================================

describe('UserService cross-module methods', () => {
  let service: UserService;

  beforeAll(() => {
    const repo = new UserRepository();
    service = new UserService(repo);
  });

  // -----------------------------------------------------------------------
  // getUserById
  // -----------------------------------------------------------------------

  describe('getUserById', () => {
    it('should return user basic info without phone', async () => {
      const user = await createTestUser({
        nickname: '跨模块用户',
        bio: '跨模块简介',
        avatarUrl: 'https://example.com/cross.jpg',
        isCoach: true,
      });

      const result = await service.getUserById(user.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(user.id);
      expect(result!.nickname).toBe('跨模块用户');
      expect(result!.bio).toBe('跨模块简介');
      expect(result!.avatarUrl).toBe('https://example.com/cross.jpg');
      expect(result!.isCoach).toBe(true);
      // Must not include phone
      expect(result).not.toHaveProperty('phone');
    });

    it('should return null for non-existent user', async () => {
      const result = await service.getUserById('00000000-0000-0000-0000-000000000000');

      expect(result).toBeNull();
    });

    it('should not throw for non-existent user', async () => {
      await expect(service.getUserById('00000000-0000-0000-0000-000000000000')).resolves.toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // getUsersByIds
  // -----------------------------------------------------------------------

  describe('getUsersByIds', () => {
    it('should return info for multiple users', async () => {
      const user1 = await createTestUser({ nickname: '批量用户一' });
      const user2 = await createTestUser({ nickname: '批量用户二' });

      const result = await service.getUsersByIds([user1.id, user2.id]);

      expect(result).toHaveLength(2);
      const ids = result.map((u) => u.id);
      expect(ids).toContain(user1.id);
      expect(ids).toContain(user2.id);
    });

    it('should return items without phone field', async () => {
      const user = await createTestUser();

      const result = await service.getUsersByIds([user.id]);

      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty('phone');
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('nickname');
      expect(result[0]).toHaveProperty('avatarUrl');
      expect(result[0]).toHaveProperty('bio');
      expect(result[0]).toHaveProperty('isCoach');
    });

    it('should exclude non-existent IDs from result', async () => {
      const user = await createTestUser({ nickname: '存在用户' });

      const result = await service.getUsersByIds([user.id, '00000000-0000-0000-0000-000000000000']);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(user.id);
    });

    it('should return empty array for empty input', async () => {
      const result = await service.getUsersByIds([]);

      expect(result).toEqual([]);
    });

    it('should not throw for any input', async () => {
      await expect(service.getUsersByIds([])).resolves.toBeDefined();
      await expect(
        service.getUsersByIds(['00000000-0000-0000-0000-000000000000']),
      ).resolves.toBeDefined();
    });
  });
});
