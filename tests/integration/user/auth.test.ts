/**
 * L1 集成测试: user 模块 — 认证功能
 *
 * 测试层级: Controller → Service → Repository 真实串联
 * 数据库: 真实 PostgreSQL 测试库
 * Mock: 无（user 为基础层，不依赖其他业务模块）
 *
 * 覆盖接口:
 * - POST /api/auth/send-code
 * - POST /api/auth/login
 * - GET /api/users/me
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '@server/app.js';
import {
  createTestUser,
  createTestVerificationCode,
  createTestPhoneLock,
  cleanupUserTestData,
  getTestPrisma,
} from '@tests/fixtures/user.js';

const prisma = getTestPrisma();

// Use a unique phone for each test to avoid collision
let phoneCounter = 0;
function nextPhone(): string {
  phoneCounter++;
  return `1380000${String(1000 + phoneCounter).slice(-4)}`;
}

beforeAll(async () => {
  await cleanupUserTestData();
});

afterEach(async () => {
  await cleanupUserTestData();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ===========================================================================
// POST /api/auth/send-code
// ===========================================================================

describe('POST /api/auth/send-code', () => {
  it('should send verification code and return success', async () => {
    const phone = nextPhone();
    const res = await request(app).post('/api/auth/send-code').send({ phone });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ message: '验证码已发送' });

    // Verify a verification code record was created in the database
    const codes = await prisma.verificationCode.findMany({ where: { phone } });
    expect(codes).toHaveLength(1);
    expect(codes[0].code).toMatch(/^\d{6}$/);
    expect(codes[0].used).toBe(false);
    // Expiry should be approximately 5 minutes from now
    const expectedExpiry = Date.now() + 5 * 60 * 1000;
    expect(codes[0].expiresAt.getTime()).toBeGreaterThan(expectedExpiry - 5000);
    expect(codes[0].expiresAt.getTime()).toBeLessThan(expectedExpiry + 5000);
  });

  it('should reject invalid phone number', async () => {
    const res = await request(app).post('/api/auth/send-code').send({ phone: '12345' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('AUTH_INVALID_PHONE');
  });

  it('should enforce 60-second rate limit', async () => {
    const phone = nextPhone();

    // First request succeeds
    const res1 = await request(app).post('/api/auth/send-code').send({ phone });
    expect(res1.status).toBe(200);

    // Second request within 60s should fail
    const res2 = await request(app).post('/api/auth/send-code').send({ phone });
    expect(res2.status).toBe(429);
    expect(res2.body.error.code).toBe('AUTH_CODE_RATE_LIMITED');
  });

  it('should reject if phone is locked', async () => {
    const phone = nextPhone();
    await createTestPhoneLock({
      phone,
      failCount: 5,
      lockedUntil: new Date(Date.now() + 20 * 60 * 1000),
    });

    const res = await request(app).post('/api/auth/send-code').send({ phone });

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('AUTH_PHONE_LOCKED');
  });

  it('should allow sending if phone lock has expired', async () => {
    const phone = nextPhone();
    await createTestPhoneLock({
      phone,
      failCount: 5,
      lockedUntil: new Date(Date.now() - 1000), // expired
    });

    const res = await request(app).post('/api/auth/send-code').send({ phone });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ message: '验证码已发送' });
  });
});

// ===========================================================================
// POST /api/auth/login
// ===========================================================================

describe('POST /api/auth/login', () => {
  it('should register a new user when phone does not exist', async () => {
    const phone = nextPhone();
    const code = '654321';
    await createTestVerificationCode({
      phone,
      code,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const res = await request(app).post('/api/auth/login').send({ phone, code });

    expect(res.status).toBe(200);
    expect(res.body.data.isNewUser).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.id).toBeDefined();
    expect(res.body.data.user.nickname).toMatch(/^球友\d{5}$/);
    expect(res.body.data.user.isCoach).toBe(false);

    // Phone should be masked
    expect(res.body.data.user.phone).toMatch(/^\d{3}\*{4}\d{4}$/);

    // Verify user was created in database
    const user = await prisma.user.findUnique({ where: { phone } });
    expect(user).not.toBeNull();
    expect(user!.phone).toBe(phone);
  });

  it('should login existing user without creating a new record', async () => {
    const phone = nextPhone();
    const existingUser = await createTestUser({ phone });
    const code = '654321';
    await createTestVerificationCode({
      phone,
      code,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const res = await request(app).post('/api/auth/login').send({ phone, code });

    expect(res.status).toBe(200);
    expect(res.body.data.isNewUser).toBe(false);
    expect(res.body.data.user.id).toBe(existingUser.id);

    // No new user should have been created
    const users = await prisma.user.findMany({ where: { phone } });
    expect(users).toHaveLength(1);
  });

  it('should register as coach when isCoach is true', async () => {
    const phone = nextPhone();
    const code = '654321';
    await createTestVerificationCode({
      phone,
      code,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const res = await request(app).post('/api/auth/login').send({ phone, code, isCoach: true });

    expect(res.status).toBe(200);
    expect(res.body.data.isNewUser).toBe(true);
    expect(res.body.data.user.isCoach).toBe(true);
  });

  it('should issue a valid JWT token with correct payload', async () => {
    const phone = nextPhone();
    const code = '654321';
    await createTestVerificationCode({
      phone,
      code,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const res = await request(app).post('/api/auth/login').send({ phone, code });

    expect(res.status).toBe(200);
    const token = res.body.data.token;
    const decoded = jwt.decode(token) as Record<string, unknown>;
    expect(decoded.userId).toBe(res.body.data.user.id);
    expect(decoded.role).toBe('user');
    // Expiry approximately 7 days
    const expectedExp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
    expect(decoded.exp).toBeGreaterThan(expectedExp - 60);
    expect(decoded.exp).toBeLessThan(expectedExp + 60);
  });

  it('should mark verification code as used after successful login', async () => {
    const phone = nextPhone();
    const code = '654321';
    const vc = await createTestVerificationCode({
      phone,
      code,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    await request(app).post('/api/auth/login').send({ phone, code });

    const updated = await prisma.verificationCode.findUnique({ where: { id: vc.id } });
    expect(updated!.used).toBe(true);
  });

  it('should reject wrong verification code and increment fail count', async () => {
    const phone = nextPhone();
    await createTestVerificationCode({
      phone,
      code: '654321',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const res = await request(app).post('/api/auth/login').send({ phone, code: '111111' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_CODE_WRONG');

    // PhoneLock failCount should be incremented
    const lock = await prisma.phoneLock.findUnique({ where: { phone } });
    expect(lock).not.toBeNull();
    expect(lock!.failCount).toBe(1);
  });

  it('should reject expired verification code', async () => {
    const phone = nextPhone();
    await createTestVerificationCode({
      phone,
      code: '654321',
      expiresAt: new Date(Date.now() - 1000), // expired
    });

    const res = await request(app).post('/api/auth/login').send({ phone, code: '654321' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_CODE_EXPIRED');
  });

  it('should reject when no verification code exists', async () => {
    const phone = nextPhone();

    const res = await request(app).post('/api/auth/login').send({ phone, code: '654321' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_CODE_WRONG');
  });

  it('should reject invalid phone format', async () => {
    const res = await request(app).post('/api/auth/login').send({ phone: '123', code: '654321' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('AUTH_INVALID_PHONE');
  });

  it('should reject invalid code format', async () => {
    const phone = nextPhone();
    const res = await request(app).post('/api/auth/login').send({ phone, code: '12ab' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('AUTH_INVALID_CODE');
  });

  it('should lock phone after 5 consecutive wrong codes', async () => {
    const phone = nextPhone();

    for (let i = 0; i < 5; i++) {
      // Create a new code for each attempt (to have a valid unused code to mismatch)
      await createTestVerificationCode({
        phone,
        code: '654321',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });

      await request(app).post('/api/auth/login').send({ phone, code: '111111' });
    }

    // Verify phone is now locked
    const lock = await prisma.phoneLock.findUnique({ where: { phone } });
    expect(lock).not.toBeNull();
    expect(lock!.failCount).toBe(5);
    expect(lock!.lockedUntil).not.toBeNull();
    expect(lock!.lockedUntil!.getTime()).toBeGreaterThan(Date.now());

    // Further login attempts should be rejected with AUTH_PHONE_LOCKED
    await createTestVerificationCode({
      phone,
      code: '654321',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });
    const res = await request(app).post('/api/auth/login').send({ phone, code: '654321' });

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('AUTH_PHONE_LOCKED');
  });

  it('should reset fail count after successful login', async () => {
    const phone = nextPhone();
    // Create a phone lock with some failures
    await createTestPhoneLock({ phone, failCount: 3, lockedUntil: null });

    const code = '654321';
    await createTestVerificationCode({
      phone,
      code,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const res = await request(app).post('/api/auth/login').send({ phone, code });

    expect(res.status).toBe(200);

    // Fail count should be reset
    const lock = await prisma.phoneLock.findUnique({ where: { phone } });
    expect(lock!.failCount).toBe(0);
    expect(lock!.lockedUntil).toBeNull();
  });

  it('should ignore isCoach parameter for existing user', async () => {
    const phone = nextPhone();
    await createTestUser({ phone, isCoach: false });
    const code = '654321';
    await createTestVerificationCode({
      phone,
      code,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const res = await request(app).post('/api/auth/login').send({ phone, code, isCoach: true });

    expect(res.status).toBe(200);
    expect(res.body.data.user.isCoach).toBe(false); // unchanged
    expect(res.body.data.isNewUser).toBe(false);
  });
});

// ===========================================================================
// GET /api/users/me
// ===========================================================================

describe('GET /api/users/me', () => {
  it('should return current user info with masked phone', async () => {
    const phone = nextPhone();
    const code = '654321';
    await createTestVerificationCode({
      phone,
      code,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    // Login to get token
    const loginRes = await request(app).post('/api/auth/login').send({ phone, code });
    const token = loginRes.body.data.token;

    // Get current user
    const res = await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(loginRes.body.data.user.id);
    expect(res.body.data.phone).toMatch(/^\d{3}\*{4}\d{4}$/);
    expect(res.body.data.nickname).toBeDefined();
    expect(res.body.data).toHaveProperty('avatarUrl');
    expect(res.body.data).toHaveProperty('bio');
    expect(res.body.data).toHaveProperty('isCoach');
    expect(res.body.data).toHaveProperty('createdAt');
  });

  it('should reject request without token', async () => {
    const res = await request(app).get('/api/users/me');

    expect(res.status).toBe(401);
  });

  it('should reject request with invalid token', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer invalid-token');

    expect(res.status).toBe(401);
  });
});
