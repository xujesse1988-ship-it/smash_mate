/**
 * 契约测试: user 模块 — 认证接口
 * 覆盖接口: POST /api/auth/send-code, POST /api/auth/login
 *
 * 来源文档: docs/module-design/user.md §4 接口契约 + §6 关键业务逻辑
 *
 * Mock 策略:
 * - UserRepository: 全部 mock（隔离数据库依赖）
 * - infra/config: 使用真实配置对象
 * - JWT: 验证签发结果格式，不 mock jwt 库本身
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { UserService } from '@server/modules/user/service.js';
import { UserRepository } from '@server/modules/user/repository.js';
import type { SendCodeInput, LoginInput } from '@server/modules/user/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock UserRepository with all methods stubbed.
 * Individual tests override specific methods as needed.
 */
function createMockRepository(): {
  [K in keyof UserRepository]: ReturnType<typeof vi.fn>;
} {
  return {
    findByPhone: vi.fn().mockResolvedValue(null),
    findById: vi.fn().mockResolvedValue(null),
    findByIds: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({
      id: 'new-user-uuid',
      phone: '13800001234',
      nickname: '球友12345',
      avatarUrl: null,
      bio: null,
      isCoach: false,
      createdAt: new Date('2026-04-01T10:00:00.000Z'),
      updatedAt: new Date('2026-04-01T10:00:00.000Z'),
    }),
    update: vi.fn().mockResolvedValue(null),
    updateCoachRole: vi.fn().mockResolvedValue(null),
    createVerificationCode: vi.fn().mockResolvedValue({
      id: 'vc-uuid',
      phone: '13800001234',
      code: '123456',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      used: false,
      createdAt: new Date(),
    }),
    findLatestVerificationCode: vi.fn().mockResolvedValue(null),
    markVerificationCodeUsed: vi.fn().mockResolvedValue(undefined),
    findOrCreatePhoneLock: vi.fn().mockResolvedValue({
      id: 'pl-uuid',
      phone: '13800001234',
      failCount: 0,
      lockedUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    updatePhoneLock: vi.fn().mockResolvedValue(undefined),
  };
}

// ===========================================================================
// POST /api/auth/send-code
// ===========================================================================

describe('POST /api/auth/send-code — UserService.sendCode', () => {
  let service: UserService;
  let repo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    repo = createMockRepository();
    service = new UserService(repo as unknown as UserRepository);
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  it('should send verification code for a valid phone number', async () => {
    // 业务规则: 手机号格式校验通过 + 无频率限制 + 无锁定 → 发送成功
    // 来源: user.md §4 发送验证码 - Response 200
    const input: SendCodeInput = { phone: '13800001234' };
    const result = await service.sendCode(input);

    expect(result).toEqual({ message: '验证码已发送' });
  });

  it('should create a verification code record with 5-minute expiry', async () => {
    // 业务规则: 验证码为 6 位随机数字，有效期 5 分钟
    // 来源: user.md §4 发送验证码 - 业务规则 bullet 3
    const input: SendCodeInput = { phone: '13800001234' };
    await service.sendCode(input);

    expect(repo.createVerificationCode).toHaveBeenCalledTimes(1);
    const callArgs = repo.createVerificationCode.mock.calls[0][0];
    expect(callArgs.phone).toBe('13800001234');
    // 验证码为 6 位数字字符串
    expect(callArgs.code).toMatch(/^\d{6}$/);
    // 过期时间大约在 5 分钟后（允许几秒误差）
    const expectedExpiry = Date.now() + 5 * 60 * 1000;
    expect(callArgs.expiresAt.getTime()).toBeGreaterThan(expectedExpiry - 5000);
    expect(callArgs.expiresAt.getTime()).toBeLessThan(expectedExpiry + 5000);
  });

  it('should check phone lock status before sending', async () => {
    // 业务规则: 发送前检查 PhoneLock 状态
    // 来源: user.md §6.1 发送验证码 步骤 2
    const input: SendCodeInput = { phone: '13800001234' };
    await service.sendCode(input);

    expect(repo.findOrCreatePhoneLock).toHaveBeenCalledWith('13800001234');
  });

  it('should check rate limit (latest verification code) before sending', async () => {
    // 业务规则: 发送前检查频率限制
    // 来源: user.md §6.1 发送验证码 步骤 3
    const input: SendCodeInput = { phone: '13800001234' };
    await service.sendCode(input);

    expect(repo.findLatestVerificationCode).toHaveBeenCalledWith('13800001234');
  });

  // -----------------------------------------------------------------------
  // 异常流程 — 手机号格式
  // -----------------------------------------------------------------------

  it('should reject phone number not starting with 1', async () => {
    // 业务规则: 手机号格式校验 — 必须以 1 开头
    // 来源: user.md §4 发送验证码 - 错误码 AUTH_INVALID_PHONE
    const input: SendCodeInput = { phone: '23800001234' };

    await expect(service.sendCode(input)).rejects.toMatchObject({
      code: 'AUTH_INVALID_PHONE',
      statusCode: 400,
    });
  });

  it('should reject phone number shorter than 11 digits', async () => {
    // 业务规则: 手机号格式校验 — 必须 11 位数字
    // 来源: user.md §4 发送验证码 - 错误码 AUTH_INVALID_PHONE
    const input: SendCodeInput = { phone: '1380000123' };

    await expect(service.sendCode(input)).rejects.toMatchObject({
      code: 'AUTH_INVALID_PHONE',
      statusCode: 400,
    });
  });

  it('should reject phone number longer than 11 digits', async () => {
    // 业务规则: 手机号格式校验 — 必须 11 位数字
    // 来源: user.md §4 发送验证码 - 错误码 AUTH_INVALID_PHONE
    const input: SendCodeInput = { phone: '138000012345' };

    await expect(service.sendCode(input)).rejects.toMatchObject({
      code: 'AUTH_INVALID_PHONE',
      statusCode: 400,
    });
  });

  it('should reject phone number with non-digit characters', async () => {
    // 业务规则: 手机号格式校验 — 必须为纯数字
    // 来源: user.md §4 发送验证码 - 错误码 AUTH_INVALID_PHONE
    const input: SendCodeInput = { phone: '1380000abcd' };

    await expect(service.sendCode(input)).rejects.toMatchObject({
      code: 'AUTH_INVALID_PHONE',
      statusCode: 400,
    });
  });

  it('should reject empty phone number', async () => {
    // 业务规则: 手机号格式校验 — 不可为空
    // 来源: user.md §4 发送验证码 - 错误码 AUTH_INVALID_PHONE
    const input: SendCodeInput = { phone: '' };

    await expect(service.sendCode(input)).rejects.toMatchObject({
      code: 'AUTH_INVALID_PHONE',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程 — 频率限制
  // -----------------------------------------------------------------------

  it('should reject if verification code was sent within 60 seconds', async () => {
    // 业务规则: 同一手机号 60 秒内不可重复发送验证码
    // 来源: user.md §4 发送验证码 - 错误码 AUTH_CODE_RATE_LIMITED
    // 来源: user.md §6.1 步骤 3: 最近一条 VerificationCode 的 createdAt + 60s > 当前时间
    repo.findLatestVerificationCode.mockResolvedValue({
      id: 'vc-uuid',
      phone: '13800001234',
      code: '654321',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      used: false,
      createdAt: new Date(Date.now() - 30 * 1000), // 30 seconds ago
    });

    const input: SendCodeInput = { phone: '13800001234' };

    await expect(service.sendCode(input)).rejects.toMatchObject({
      code: 'AUTH_CODE_RATE_LIMITED',
      statusCode: 429,
    });
  });

  it('should allow sending if last verification code was sent over 60 seconds ago', async () => {
    // 业务规则: 60 秒后可以重新发送
    // 来源: user.md §4 发送验证码 - 业务规则 bullet 2（反面验证）
    repo.findLatestVerificationCode.mockResolvedValue({
      id: 'vc-uuid',
      phone: '13800001234',
      code: '654321',
      expiresAt: new Date(Date.now() + 3 * 60 * 1000),
      used: false,
      createdAt: new Date(Date.now() - 61 * 1000), // 61 seconds ago
    });

    const input: SendCodeInput = { phone: '13800001234' };
    const result = await service.sendCode(input);

    expect(result).toEqual({ message: '验证码已发送' });
  });

  // -----------------------------------------------------------------------
  // 异常流程 — 手机号锁定
  // -----------------------------------------------------------------------

  it('should reject if phone is locked (lockedUntil in the future)', async () => {
    // 业务规则: 该手机号当前处于锁定状态时拒绝发送
    // 来源: user.md §4 发送验证码 - 错误码 AUTH_PHONE_LOCKED
    // 来源: user.md §6.1 步骤 2
    repo.findOrCreatePhoneLock.mockResolvedValue({
      id: 'pl-uuid',
      phone: '13800001234',
      failCount: 5,
      lockedUntil: new Date(Date.now() + 20 * 60 * 1000), // locked for 20 more minutes
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const input: SendCodeInput = { phone: '13800001234' };

    await expect(service.sendCode(input)).rejects.toMatchObject({
      code: 'AUTH_PHONE_LOCKED',
      statusCode: 429,
    });
  });

  it('should allow sending if phone lock has expired (lockedUntil in the past)', async () => {
    // 业务规则: 锁定过期后自动恢复为正常状态
    // 来源: user.md §6.3 手机号锁定机制 — 锁定过期后自动恢复
    repo.findOrCreatePhoneLock.mockResolvedValue({
      id: 'pl-uuid',
      phone: '13800001234',
      failCount: 5,
      lockedUntil: new Date(Date.now() - 1000), // expired 1 second ago
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const input: SendCodeInput = { phone: '13800001234' };
    const result = await service.sendCode(input);

    expect(result).toEqual({ message: '验证码已发送' });
  });
});

// ===========================================================================
// POST /api/auth/login
// ===========================================================================

describe('POST /api/auth/login — UserService.login', () => {
  let service: UserService;
  let repo: ReturnType<typeof createMockRepository>;

  const validCode = '123456';
  const validPhone = '13800001234';

  /** Helper: set up repository to have a valid, unused verification code */
  function setupValidVerificationCode() {
    repo.findLatestVerificationCode.mockResolvedValue({
      id: 'vc-uuid',
      phone: validPhone,
      code: validCode,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // not expired
      used: false,
      createdAt: new Date(Date.now() - 30 * 1000),
    });
  }

  /** Helper: set up repository with an existing user */
  function setupExistingUser() {
    const user = {
      id: 'existing-user-uuid',
      phone: validPhone,
      nickname: '老用户',
      avatarUrl: 'https://example.com/avatar.jpg',
      bio: '打球爱好者',
      isCoach: false,
      createdAt: new Date('2026-03-01T10:00:00.000Z'),
      updatedAt: new Date('2026-03-15T10:00:00.000Z'),
    };
    repo.findByPhone.mockResolvedValue(user);
    return user;
  }

  beforeEach(() => {
    repo = createMockRepository();
    service = new UserService(repo as unknown as UserRepository);
  });

  // -----------------------------------------------------------------------
  // 正常流程 — 新用户注册
  // -----------------------------------------------------------------------

  it('should register a new user when phone does not exist', async () => {
    // 业务规则: 手机号不存在于 User 表时自动创建新用户
    // 来源: user.md §4 登录/注册 - 业务规则 bullet 5
    // 来源: user.md §6.2 步骤 4b
    setupValidVerificationCode();
    repo.findByPhone.mockResolvedValue(null); // phone not registered

    const input: LoginInput = { phone: validPhone, code: validCode };
    const result = await service.login(input);

    expect(result.isNewUser).toBe(true);
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');
    expect(result.token.length).toBeGreaterThan(0);
    expect(result.user).toBeDefined();
    expect(result.user.id).toBeDefined();
  });

  it('should auto-generate nickname for new user as "球友" + 5 digits', async () => {
    // 业务规则: 新用户 nickname 自动生成 — 球友 + 5 位随机数字
    // 来源: user.md §4 登录/注册 - 业务规则 bullet 5 sub-bullet 1
    setupValidVerificationCode();
    repo.findByPhone.mockResolvedValue(null);

    const input: LoginInput = { phone: validPhone, code: validCode };
    await service.login(input);

    expect(repo.create).toHaveBeenCalledTimes(1);
    const createArgs = repo.create.mock.calls[0][0];
    expect(createArgs.nickname).toMatch(/^球友\d{5}$/);
  });

  it('should set isCoach from request parameter for new user registration', async () => {
    // 业务规则: 新用户 isCoach 取请求参数值
    // 来源: user.md §4 登录/注册 - 业务规则 bullet 5 sub-bullet 2
    setupValidVerificationCode();
    repo.findByPhone.mockResolvedValue(null);

    const input: LoginInput = { phone: validPhone, code: validCode, isCoach: true };
    await service.login(input);

    expect(repo.create).toHaveBeenCalledTimes(1);
    const createArgs = repo.create.mock.calls[0][0];
    expect(createArgs.isCoach).toBe(true);
  });

  it('should default isCoach to false for new user when not provided', async () => {
    // 业务规则: isCoach 默认 false
    // 来源: user.md §4 登录/注册 - Request Body - isCoach 默认 false
    setupValidVerificationCode();
    repo.findByPhone.mockResolvedValue(null);

    const input: LoginInput = { phone: validPhone, code: validCode };
    await service.login(input);

    expect(repo.create).toHaveBeenCalledTimes(1);
    const createArgs = repo.create.mock.calls[0][0];
    expect(createArgs.isCoach).toBe(false);
  });

  // -----------------------------------------------------------------------
  // 正常流程 — 已有用户登录
  // -----------------------------------------------------------------------

  it('should login existing user without creating a new record', async () => {
    // 业务规则: 手机号已存在 → 现有用户登录
    // 来源: user.md §6.2 步骤 4a
    setupValidVerificationCode();
    const existingUser = setupExistingUser();

    const input: LoginInput = { phone: validPhone, code: validCode };
    const result = await service.login(input);

    expect(result.isNewUser).toBe(false);
    expect(result.user.id).toBe(existingUser.id);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('should ignore isCoach parameter for existing user', async () => {
    // 业务规则: 对已存在用户该参数被忽略
    // 来源: user.md §4 登录/注册 - Request Body - isCoach 说明
    setupValidVerificationCode();
    const existingUser = setupExistingUser(); // isCoach = false

    const input: LoginInput = { phone: validPhone, code: validCode, isCoach: true };
    const result = await service.login(input);

    expect(result.user.isCoach).toBe(existingUser.isCoach); // stays false
    expect(repo.updateCoachRole).not.toHaveBeenCalled();
  });

  it('should return HTTP 200 for both new and existing users', async () => {
    // 业务规则: 无论新用户注册还是老用户登录，统一返回 HTTP 200
    // 来源: user.md §4 登录/注册 - 业务规则 bullet 1
    // NOTE: HTTP status is the controller's responsibility; at service level,
    // we verify that both paths return successfully (no exception thrown).
    setupValidVerificationCode();
    repo.findByPhone.mockResolvedValue(null);

    const inputNew: LoginInput = { phone: validPhone, code: validCode };
    await expect(service.login(inputNew)).resolves.toBeDefined();

    // Reset for existing user path
    repo = createMockRepository();
    service = new UserService(repo as unknown as UserRepository);
    setupValidVerificationCode();
    setupExistingUser();

    const inputExisting: LoginInput = { phone: validPhone, code: validCode };
    await expect(service.login(inputExisting)).resolves.toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 正常流程 — JWT token
  // -----------------------------------------------------------------------

  it('should return a valid JWT token string', async () => {
    // 业务规则: 签发 JWT token（payload: { userId, role: "user" }，有效期 7 天）
    // 来源: user.md §4 登录/注册 - 业务规则 bullet 8
    // 来源: user.md §6.2 步骤 5
    setupValidVerificationCode();
    setupExistingUser();

    const input: LoginInput = { phone: validPhone, code: validCode };
    const result = await service.login(input);

    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');
    // JWT format: header.payload.signature
    expect(result.token.split('.')).toHaveLength(3);
  });

  it('should include userId and role in JWT payload with 7-day expiry', async () => {
    // 业务规则: JWT payload 包含 { userId: string, role: "user" }，有效期 7 天
    // 来源: user.md §4 登录/注册 - 业务规则 bullet 8（第 188-189 行）
    // 来源: user.md §6.2 步骤 5
    setupValidVerificationCode();
    const existingUser = setupExistingUser();

    const input: LoginInput = { phone: validPhone, code: validCode };
    const result = await service.login(input);

    // Decode JWT without verification (contract test does not know the secret)
    const decoded = jwt.decode(result.token) as Record<string, unknown> | null;
    expect(decoded).not.toBeNull();

    // Verify userId matches the logged-in user
    expect(decoded!.userId).toBe(existingUser.id);

    // Verify role is "user"
    expect(decoded!.role).toBe('user');

    // Verify expiry is approximately 7 days from now
    // JWT exp is in seconds, not milliseconds
    expect(decoded!.exp).toBeDefined();
    const expectedExp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
    expect(decoded!.exp).toBeGreaterThan(expectedExp - 60); // allow 60s tolerance
    expect(decoded!.exp).toBeLessThan(expectedExp + 60);
  });

  it('should include correct userId in JWT payload for new user', async () => {
    // 业务规则: 新用户注册后签发的 JWT 中 userId 应为新创建用户的 ID
    // 来源: user.md §4 登录/注册 - 业务规则 bullet 8（第 188 行）
    setupValidVerificationCode();
    repo.findByPhone.mockResolvedValue(null); // new user

    const input: LoginInput = { phone: validPhone, code: validCode };
    const result = await service.login(input);

    const decoded = jwt.decode(result.token) as Record<string, unknown> | null;
    expect(decoded).not.toBeNull();
    expect(decoded!.userId).toBe(result.user.id);
    expect(decoded!.role).toBe('user');
  });

  // -----------------------------------------------------------------------
  // 正常流程 — 手机号脱敏
  // -----------------------------------------------------------------------

  it('should mask phone number in response (format: 138****1234)', async () => {
    // 业务规则: 响应中 phone 字段做脱敏处理
    // 来源: user.md §4 登录/注册 - 业务规则 bullet 9
    // 来源: user.md §6.4 手机号脱敏规则
    setupValidVerificationCode();
    setupExistingUser();

    const input: LoginInput = { phone: validPhone, code: validCode };
    const result = await service.login(input);

    expect(result.user.phone).toBe('138****1234');
    expect(result.user.phone).not.toBe(validPhone);
  });

  // -----------------------------------------------------------------------
  // 正常流程 — 验证码使用后标记 + 锁定重置
  // -----------------------------------------------------------------------

  it('should mark verification code as used after successful login', async () => {
    // 业务规则: 验证成功后标记该验证码为已使用（used = true）
    // 来源: user.md §4 登录/注册 - 业务规则 bullet 3
    // 来源: user.md §6.1 验证码验证 步骤 5
    setupValidVerificationCode();
    setupExistingUser();

    const input: LoginInput = { phone: validPhone, code: validCode };
    await service.login(input);

    expect(repo.markVerificationCodeUsed).toHaveBeenCalledWith('vc-uuid');
  });

  it('should reset PhoneLock failCount after successful login', async () => {
    // 业务规则: 验证成功后重置 PhoneLock 的 failCount
    // 来源: user.md §4 登录/注册 - 业务规则 bullet 3
    // 来源: user.md §6.1 验证码验证 步骤 5
    // 来源: user.md §6.3 验证成功 → failCount 重置为 0，lockedUntil 清空
    repo.findOrCreatePhoneLock.mockResolvedValue({
      id: 'pl-uuid',
      phone: validPhone,
      failCount: 3,
      lockedUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    setupValidVerificationCode();
    setupExistingUser();

    const input: LoginInput = { phone: validPhone, code: validCode };
    await service.login(input);

    expect(repo.updatePhoneLock).toHaveBeenCalledWith('pl-uuid', {
      failCount: 0,
      lockedUntil: null,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程 — 手机号格式
  // -----------------------------------------------------------------------

  it('should reject invalid phone format on login', async () => {
    // 业务规则: 手机号格式校验同 send-code
    // 来源: user.md §4 登录/注册 - 错误码 AUTH_INVALID_PHONE
    const input: LoginInput = { phone: '2380000', code: validCode };

    await expect(service.login(input)).rejects.toMatchObject({
      code: 'AUTH_INVALID_PHONE',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程 — 验证码格式
  // -----------------------------------------------------------------------

  it('should reject verification code that is not 6 digits', async () => {
    // 业务规则: 验证码格式不合法（非 6 位数字）
    // 来源: user.md §4 登录/注册 - 错误码 AUTH_INVALID_CODE
    const input: LoginInput = { phone: validPhone, code: '12345' }; // only 5 digits

    await expect(service.login(input)).rejects.toMatchObject({
      code: 'AUTH_INVALID_CODE',
      statusCode: 400,
    });
  });

  it('should reject verification code with non-digit characters', async () => {
    // 业务规则: 验证码格式不合法（非 6 位数字）
    // 来源: user.md §4 登录/注册 - 错误码 AUTH_INVALID_CODE
    const input: LoginInput = { phone: validPhone, code: '12ab56' };

    await expect(service.login(input)).rejects.toMatchObject({
      code: 'AUTH_INVALID_CODE',
      statusCode: 400,
    });
  });

  it('should reject empty verification code', async () => {
    // 业务规则: 验证码格式不合法
    // 来源: user.md §4 登录/注册 - 错误码 AUTH_INVALID_CODE
    const input: LoginInput = { phone: validPhone, code: '' };

    await expect(service.login(input)).rejects.toMatchObject({
      code: 'AUTH_INVALID_CODE',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程 — 手机号锁定
  // -----------------------------------------------------------------------

  it('should reject login if phone is locked', async () => {
    // 业务规则: 登录前检查 PhoneLock 锁定状态
    // 来源: user.md §4 登录/注册 - 错误码 AUTH_PHONE_LOCKED
    // 来源: user.md §6.2 步骤 2
    repo.findOrCreatePhoneLock.mockResolvedValue({
      id: 'pl-uuid',
      phone: validPhone,
      failCount: 5,
      lockedUntil: new Date(Date.now() + 20 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const input: LoginInput = { phone: validPhone, code: validCode };

    await expect(service.login(input)).rejects.toMatchObject({
      code: 'AUTH_PHONE_LOCKED',
      statusCode: 429,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程 — 验证码错误
  // -----------------------------------------------------------------------

  it('should reject when no unused verification code exists for the phone', async () => {
    // 业务规则: 无未使用的验证码记录 → AUTH_CODE_WRONG
    // 来源: user.md §6.1 验证码验证 步骤 2
    // 安全设计: 步骤 2 和步骤 4 统一返回 AUTH_CODE_WRONG
    repo.findLatestVerificationCode.mockResolvedValue(null);

    const input: LoginInput = { phone: validPhone, code: validCode };

    await expect(service.login(input)).rejects.toMatchObject({
      code: 'AUTH_CODE_WRONG',
      statusCode: 401,
    });
  });

  it('should reject when verification code does not match', async () => {
    // 业务规则: code 不匹配 → 递增 failCount → AUTH_CODE_WRONG
    // 来源: user.md §6.1 验证码验证 步骤 4
    repo.findLatestVerificationCode.mockResolvedValue({
      id: 'vc-uuid',
      phone: validPhone,
      code: '999999', // different from input
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      used: false,
      createdAt: new Date(Date.now() - 30 * 1000),
    });

    const input: LoginInput = { phone: validPhone, code: '123456' };

    await expect(service.login(input)).rejects.toMatchObject({
      code: 'AUTH_CODE_WRONG',
      statusCode: 401,
    });
  });

  it('should increment PhoneLock failCount when verification code is wrong', async () => {
    // 业务规则: 验证失败时递增 PhoneLock.failCount
    // 来源: user.md §4 登录/注册 - 业务规则 bullet 4
    // 来源: user.md §6.1 验证码验证 步骤 4
    repo.findOrCreatePhoneLock.mockResolvedValue({
      id: 'pl-uuid',
      phone: validPhone,
      failCount: 2,
      lockedUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    repo.findLatestVerificationCode.mockResolvedValue({
      id: 'vc-uuid',
      phone: validPhone,
      code: '999999',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      used: false,
      createdAt: new Date(Date.now() - 30 * 1000),
    });

    const input: LoginInput = { phone: validPhone, code: '123456' };

    await expect(service.login(input)).rejects.toThrow();
    expect(repo.updatePhoneLock).toHaveBeenCalledWith('pl-uuid', {
      failCount: 3,
      lockedUntil: null,
    });
  });

  it('should lock phone when failCount reaches 5', async () => {
    // 业务规则: 达到 5 次时设置 lockedUntil = 当前时间 + 30 分钟
    // 来源: user.md §4 登录/注册 - 业务规则 bullet 4
    // 来源: user.md §6.3 failCount 达到 5 → 设置 lockedUntil
    repo.findOrCreatePhoneLock.mockResolvedValue({
      id: 'pl-uuid',
      phone: validPhone,
      failCount: 4, // will become 5 after this failure
      lockedUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    repo.findLatestVerificationCode.mockResolvedValue({
      id: 'vc-uuid',
      phone: validPhone,
      code: '999999',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      used: false,
      createdAt: new Date(Date.now() - 30 * 1000),
    });

    const input: LoginInput = { phone: validPhone, code: '123456' };

    await expect(service.login(input)).rejects.toThrow();
    expect(repo.updatePhoneLock).toHaveBeenCalledTimes(1);
    const lockArgs = repo.updatePhoneLock.mock.calls[0][1];
    expect(lockArgs.failCount).toBe(5);
    // lockedUntil should be approximately 30 minutes from now
    expect(lockArgs.lockedUntil).toBeDefined();
    expect(lockArgs.lockedUntil).not.toBeNull();
    const expectedLockUntil = Date.now() + 30 * 60 * 1000;
    expect(lockArgs.lockedUntil!.getTime()).toBeGreaterThan(expectedLockUntil - 5000);
    expect(lockArgs.lockedUntil!.getTime()).toBeLessThan(expectedLockUntil + 5000);
  });

  // -----------------------------------------------------------------------
  // 异常流程 — 验证码已过期
  // -----------------------------------------------------------------------

  it('should reject when verification code has expired', async () => {
    // 业务规则: expiresAt < 当前时间 → AUTH_CODE_EXPIRED
    // 来源: user.md §6.1 验证码验证 步骤 3
    // 来源: user.md §4 登录/注册 - 错误码 AUTH_CODE_EXPIRED
    repo.findLatestVerificationCode.mockResolvedValue({
      id: 'vc-uuid',
      phone: validPhone,
      code: validCode,
      expiresAt: new Date(Date.now() - 1000), // expired 1 second ago
      used: false,
      createdAt: new Date(Date.now() - 6 * 60 * 1000),
    });

    const input: LoginInput = { phone: validPhone, code: validCode };

    await expect(service.login(input)).rejects.toMatchObject({
      code: 'AUTH_CODE_EXPIRED',
      statusCode: 401,
    });
  });

  // -----------------------------------------------------------------------
  // 正常流程 — LoginResponse 结构验证
  // -----------------------------------------------------------------------

  it('should return complete LoginResponse structure for new user', async () => {
    // 业务规则: 返回 token、用户信息、isNewUser 标识
    // 来源: user.md §4 登录/注册 - Response 200
    setupValidVerificationCode();
    repo.findByPhone.mockResolvedValue(null);

    const input: LoginInput = { phone: validPhone, code: validCode };
    const result = await service.login(input);

    // Verify response structure
    expect(result).toHaveProperty('token');
    expect(result).toHaveProperty('user');
    expect(result).toHaveProperty('isNewUser');
    expect(result.user).toHaveProperty('id');
    expect(result.user).toHaveProperty('phone');
    expect(result.user).toHaveProperty('nickname');
    expect(result.user).toHaveProperty('avatarUrl');
    expect(result.user).toHaveProperty('bio');
    expect(result.user).toHaveProperty('isCoach');
    expect(result.user).toHaveProperty('createdAt');
  });

  it('should return complete LoginResponse structure for existing user', async () => {
    // 业务规则: 已有用户登录返回完整用户信息
    // 来源: user.md §4 登录/注册 - Response 200
    setupValidVerificationCode();
    setupExistingUser();

    const input: LoginInput = { phone: validPhone, code: validCode };
    const result = await service.login(input);

    expect(result).toHaveProperty('token');
    expect(result).toHaveProperty('user');
    expect(result).toHaveProperty('isNewUser');
    expect(result.user).toHaveProperty('id');
    expect(result.user).toHaveProperty('phone');
    expect(result.user).toHaveProperty('nickname');
    expect(result.user).toHaveProperty('avatarUrl');
    expect(result.user).toHaveProperty('bio');
    expect(result.user).toHaveProperty('isCoach');
    expect(result.user).toHaveProperty('createdAt');
  });

  // -----------------------------------------------------------------------
  // 边界情况 — 已使用的验证码
  // -----------------------------------------------------------------------

  it('should not match an already-used verification code', async () => {
    // 业务规则: 验证码匹配条件包含 used = false
    // 来源: user.md §4 登录/注册 - 业务规则 bullet 2
    // Repository 的 findLatestVerificationCode 应只返回 used = false 的记录
    // 如果 repo 返回 null（没有未使用的记录），应该报错
    repo.findLatestVerificationCode.mockResolvedValue(null);

    const input: LoginInput = { phone: validPhone, code: validCode };

    await expect(service.login(input)).rejects.toMatchObject({
      code: 'AUTH_CODE_WRONG',
      statusCode: 401,
    });
  });
});
