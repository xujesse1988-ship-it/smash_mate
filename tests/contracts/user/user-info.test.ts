/**
 * 契约测试: user 模块 — 用户信息与资料管理接口
 * 覆盖接口:
 *   - GET /api/users/me (UserService.getCurrentUser)
 *   - PUT /api/users/me (UserService.updateProfile)
 *   - PUT /api/users/me/coach-role (UserService.updateCoachRole)
 *   - GET /api/users/:id (UserService.getUserPublicInfo)
 *   - UserService.getUserById (跨模块 Service 调用)
 *   - UserService.getUsersByIds (跨模块 Service 调用)
 *
 * 来源文档: docs/module-design/user.md §4 接口契约 + §6 关键业务逻辑
 *
 * Mock 策略:
 * - UserRepository: 全部 mock（隔离数据库依赖）
 * - infra/config: 使用真实配置对象
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserService } from '@server/modules/user/service.js';
import { UserRepository } from '@server/modules/user/repository.js';
import type { UpdateProfileInput } from '@server/modules/user/types.js';

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
    create: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue(null),
    updateCoachRole: vi.fn().mockResolvedValue(null),
    createVerificationCode: vi.fn().mockResolvedValue(null),
    findLatestVerificationCode: vi.fn().mockResolvedValue(null),
    markVerificationCodeUsed: vi.fn().mockResolvedValue(undefined),
    findOrCreatePhoneLock: vi.fn().mockResolvedValue(null),
    updatePhoneLock: vi.fn().mockResolvedValue(undefined),
  };
}

/** Standard user record as returned by repository */
function createUserRecord(overrides?: Partial<{
  id: string;
  phone: string;
  nickname: string;
  avatarUrl: string | null;
  bio: string | null;
  isCoach: boolean;
  createdAt: Date;
  updatedAt: Date;
}>) {
  return {
    id: 'user-uuid-1',
    phone: '13800001234',
    nickname: '测试用户',
    avatarUrl: 'https://example.com/avatar.jpg',
    bio: '打球爱好者',
    isCoach: false,
    createdAt: new Date('2026-04-01T10:00:00.000Z'),
    updatedAt: new Date('2026-04-01T10:00:00.000Z'),
    ...overrides,
  };
}

// ===========================================================================
// GET /api/users/me — UserService.getCurrentUser
// ===========================================================================

describe('GET /api/users/me — UserService.getCurrentUser', () => {
  let service: UserService;
  let repo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    repo = createMockRepository();
    service = new UserService(repo as unknown as UserRepository);
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  it('should return current user info by userId from JWT', async () => {
    // 业务规则: 从 JWT token 中解析 userId，查询 User 表
    // 来源: user.md §4 获取当前用户信息 - 业务规则 bullet 1
    const user = createUserRecord();
    repo.findById.mockResolvedValue(user);

    const result = await service.getCurrentUser('user-uuid-1');

    expect(repo.findById).toHaveBeenCalledWith('user-uuid-1');
    expect(result).toBeDefined();
    expect(result.id).toBe('user-uuid-1');
    expect(result.nickname).toBe('测试用户');
    expect(result.avatarUrl).toBe('https://example.com/avatar.jpg');
    expect(result.bio).toBe('打球爱好者');
    expect(result.isCoach).toBe(false);
    expect(result.createdAt).toBeDefined();
  });

  it('should mask phone number in response (format: 138****1234)', async () => {
    // 业务规则: phone 字段做脱敏处理
    // 来源: user.md §4 获取当前用户信息 - 业务规则 bullet 2
    // 来源: user.md §6.4 手机号脱敏规则
    const user = createUserRecord({ phone: '13812345678' });
    repo.findById.mockResolvedValue(user);

    const result = await service.getCurrentUser('user-uuid-1');

    expect(result.phone).toBe('138****5678');
    expect(result.phone).not.toBe('13812345678');
  });

  it('should return complete user fields in response', async () => {
    // 业务规则: 返回完整用户信息
    // 来源: user.md §4 获取当前用户信息 - Response 200
    const user = createUserRecord();
    repo.findById.mockResolvedValue(user);

    const result = await service.getCurrentUser('user-uuid-1');

    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('phone');
    expect(result).toHaveProperty('nickname');
    expect(result).toHaveProperty('avatarUrl');
    expect(result).toHaveProperty('bio');
    expect(result).toHaveProperty('isCoach');
    expect(result).toHaveProperty('createdAt');
  });

  it('should return user with null optional fields', async () => {
    // 业务规则: avatarUrl 和 bio 可以为 null
    // 来源: user.md §3 数据模型 User — avatarUrl/bio 可为 null
    const user = createUserRecord({ avatarUrl: null, bio: null });
    repo.findById.mockResolvedValue(user);

    const result = await service.getCurrentUser('user-uuid-1');

    expect(result.avatarUrl).toBeNull();
    expect(result.bio).toBeNull();
  });

  // -----------------------------------------------------------------------
  // 异常流程
  // -----------------------------------------------------------------------

  it('should throw USER_NOT_FOUND when user does not exist', async () => {
    // 业务规则: 用户不存在（异常情况：token 有效但用户已被删除）
    // 来源: user.md §4 获取当前用户信息 - 错误码 USER_NOT_FOUND
    repo.findById.mockResolvedValue(null);

    await expect(service.getCurrentUser('nonexistent-uuid')).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
      statusCode: 404,
    });
  });
});

// ===========================================================================
// PUT /api/users/me — UserService.updateProfile
// ===========================================================================

describe('PUT /api/users/me — UserService.updateProfile', () => {
  let service: UserService;
  let repo: ReturnType<typeof createMockRepository>;

  const userId = 'user-uuid-1';

  beforeEach(() => {
    repo = createMockRepository();
    service = new UserService(repo as unknown as UserRepository);
    // Default: user exists
    repo.findById.mockResolvedValue(createUserRecord());
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  it('should update nickname when provided', async () => {
    // 业务规则: 只更新请求体中包含的字段
    // 来源: user.md §4 更新个人资料 - 业务规则 bullet 1
    const updatedUser = createUserRecord({ nickname: '新昵称' });
    repo.update.mockResolvedValue(updatedUser);

    const input: UpdateProfileInput = { nickname: '新昵称' };
    const result = await service.updateProfile(userId, input);

    expect(repo.update).toHaveBeenCalledWith(userId, expect.objectContaining({ nickname: '新昵称' }));
    expect(result.nickname).toBe('新昵称');
  });

  it('should update avatarUrl when provided', async () => {
    // 业务规则: 只更新请求体中包含的字段
    // 来源: user.md §4 更新个人资料 - 业务规则 bullet 1
    const newUrl = 'https://new-example.com/avatar.png';
    const updatedUser = createUserRecord({ avatarUrl: newUrl });
    repo.update.mockResolvedValue(updatedUser);

    const input: UpdateProfileInput = { avatarUrl: newUrl };
    const result = await service.updateProfile(userId, input);

    expect(repo.update).toHaveBeenCalledWith(userId, expect.objectContaining({ avatarUrl: newUrl }));
    expect(result.avatarUrl).toBe(newUrl);
  });

  it('should update bio when provided', async () => {
    // 业务规则: 只更新请求体中包含的字段
    // 来源: user.md §4 更新个人资料 - 业务规则 bullet 1
    const updatedUser = createUserRecord({ bio: '新简介' });
    repo.update.mockResolvedValue(updatedUser);

    const input: UpdateProfileInput = { bio: '新简介' };
    const result = await service.updateProfile(userId, input);

    expect(repo.update).toHaveBeenCalledWith(userId, expect.objectContaining({ bio: '新简介' }));
    expect(result.bio).toBe('新简介');
  });

  it('should update multiple fields at once', async () => {
    // 业务规则: 只更新请求体中包含的字段
    // 来源: user.md §4 更新个人资料 - 业务规则 bullet 1
    const updatedUser = createUserRecord({
      nickname: '新昵称',
      bio: '新简介',
      avatarUrl: 'https://new.com/img.jpg',
    });
    repo.update.mockResolvedValue(updatedUser);

    const input: UpdateProfileInput = {
      nickname: '新昵称',
      bio: '新简介',
      avatarUrl: 'https://new.com/img.jpg',
    };
    const result = await service.updateProfile(userId, input);

    expect(repo.update).toHaveBeenCalledWith(userId, expect.objectContaining(input));
    expect(result.nickname).toBe('新昵称');
    expect(result.bio).toBe('新简介');
    expect(result.avatarUrl).toBe('https://new.com/img.jpg');
  });

  it('should preserve unchanged fields when only some fields are provided', async () => {
    // 业务规则: 未提供的字段保持不变
    // 来源: user.md §4 更新个人资料 - 业务规则 bullet 1
    const originalUser = createUserRecord({
      nickname: '原昵称',
      bio: '原简介',
      avatarUrl: 'https://original.com/avatar.jpg',
    });
    repo.findById.mockResolvedValue(originalUser);
    const updatedUser = { ...originalUser, nickname: '新昵称' };
    repo.update.mockResolvedValue(updatedUser);

    const input: UpdateProfileInput = { nickname: '新昵称' };
    const result = await service.updateProfile(userId, input);

    // bio and avatarUrl should remain unchanged
    expect(result.bio).toBe('原简介');
    expect(result.avatarUrl).toBe('https://original.com/avatar.jpg');
  });

  it('should mask phone number in response', async () => {
    // 业务规则: 响应中 phone 字段做脱敏处理
    // 来源: user.md §4 更新个人资料 - Response 200（phone 字段格式 138****1234）
    const updatedUser = createUserRecord({ phone: '13812345678', nickname: '新昵称' });
    repo.update.mockResolvedValue(updatedUser);

    const input: UpdateProfileInput = { nickname: '新昵称' };
    const result = await service.updateProfile(userId, input);

    expect(result.phone).toBe('138****5678');
  });

  it('should return complete user fields in response', async () => {
    // 业务规则: 返回更新后的完整用户信息
    // 来源: user.md §4 更新个人资料 - Response 200
    const updatedUser = createUserRecord({ nickname: '新昵称' });
    repo.update.mockResolvedValue(updatedUser);

    const input: UpdateProfileInput = { nickname: '新昵称' };
    const result = await service.updateProfile(userId, input);

    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('phone');
    expect(result).toHaveProperty('nickname');
    expect(result).toHaveProperty('avatarUrl');
    expect(result).toHaveProperty('bio');
    expect(result).toHaveProperty('isCoach');
    expect(result).toHaveProperty('createdAt');
  });

  // -----------------------------------------------------------------------
  // 正常流程 — nickname 边界值
  // -----------------------------------------------------------------------

  it('should accept nickname with exactly 2 characters (minimum)', async () => {
    // 业务规则: 昵称长度限制 2-20 个字符
    // 来源: user.md §4 更新个人资料 - 业务规则 bullet 2
    const updatedUser = createUserRecord({ nickname: '好的' });
    repo.update.mockResolvedValue(updatedUser);

    const input: UpdateProfileInput = { nickname: '好的' };
    const result = await service.updateProfile(userId, input);

    expect(result.nickname).toBe('好的');
  });

  it('should accept nickname with exactly 20 characters (maximum)', async () => {
    // 业务规则: 昵称长度限制 2-20 个字符
    // 来源: user.md §4 更新个人资料 - 业务规则 bullet 2
    const longNickname = '一二三四五六七八九十一二三四五六七八九十'; // 20 chars
    const updatedUser = createUserRecord({ nickname: longNickname });
    repo.update.mockResolvedValue(updatedUser);

    const input: UpdateProfileInput = { nickname: longNickname };
    const result = await service.updateProfile(userId, input);

    expect(result.nickname).toBe(longNickname);
  });

  // -----------------------------------------------------------------------
  // 正常流程 — bio 边界值
  // -----------------------------------------------------------------------

  it('should accept bio with exactly 200 characters (maximum)', async () => {
    // 业务规则: bio 长度限制最长 200 字符
    // 来源: user.md §4 更新个人资料 - 业务规则 bullet 3
    const longBio = '字'.repeat(200);
    const updatedUser = createUserRecord({ bio: longBio });
    repo.update.mockResolvedValue(updatedUser);

    const input: UpdateProfileInput = { bio: longBio };
    const result = await service.updateProfile(userId, input);

    expect(result.bio).toBe(longBio);
  });

  // -----------------------------------------------------------------------
  // 正常流程 — avatarUrl 格式
  // -----------------------------------------------------------------------

  it('should accept avatarUrl starting with https://', async () => {
    // 业务规则: 必须以 http:// 或 https:// 开头的合法 URL
    // 来源: user.md §4 更新个人资料 - 业务规则 bullet 4
    const url = 'https://cdn.example.com/images/avatar.png';
    const updatedUser = createUserRecord({ avatarUrl: url });
    repo.update.mockResolvedValue(updatedUser);

    const input: UpdateProfileInput = { avatarUrl: url };
    const result = await service.updateProfile(userId, input);

    expect(result.avatarUrl).toBe(url);
  });

  it('should accept avatarUrl starting with http://', async () => {
    // 业务规则: 必须以 http:// 或 https:// 开头的合法 URL
    // 来源: user.md §4 更新个人资料 - 业务规则 bullet 4
    const url = 'http://cdn.example.com/images/avatar.png';
    const updatedUser = createUserRecord({ avatarUrl: url });
    repo.update.mockResolvedValue(updatedUser);

    const input: UpdateProfileInput = { avatarUrl: url };
    const result = await service.updateProfile(userId, input);

    expect(result.avatarUrl).toBe(url);
  });

  // -----------------------------------------------------------------------
  // 异常流程 — nickname 校验
  // -----------------------------------------------------------------------

  it('should reject empty string nickname', async () => {
    // 业务规则: nickname 不可为空字符串
    // 来源: user.md §4 更新个人资料 - 错误码 USER_INVALID_NICKNAME
    const input: UpdateProfileInput = { nickname: '' };

    await expect(service.updateProfile(userId, input)).rejects.toMatchObject({
      code: 'USER_INVALID_NICKNAME',
      statusCode: 400,
    });
  });

  it('should reject nickname shorter than 2 characters', async () => {
    // 业务规则: 昵称长度限制 2-20 个字符
    // 来源: user.md §4 更新个人资料 - 错误码 USER_INVALID_NICKNAME
    const input: UpdateProfileInput = { nickname: '好' }; // 1 char

    await expect(service.updateProfile(userId, input)).rejects.toMatchObject({
      code: 'USER_INVALID_NICKNAME',
      statusCode: 400,
    });
  });

  it('should reject nickname longer than 20 characters', async () => {
    // 业务规则: 昵称长度限制 2-20 个字符
    // 来源: user.md §4 更新个人资料 - 错误码 USER_INVALID_NICKNAME
    const longNickname = '一二三四五六七八九十一二三四五六七八九十多'; // 21 chars

    const input: UpdateProfileInput = { nickname: longNickname };

    await expect(service.updateProfile(userId, input)).rejects.toMatchObject({
      code: 'USER_INVALID_NICKNAME',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程 — bio 校验
  // -----------------------------------------------------------------------

  it('should reject bio longer than 200 characters', async () => {
    // 业务规则: bio 长度限制最长 200 字符
    // 来源: user.md §4 更新个人资料 - 错误码 USER_INVALID_BIO
    const longBio = '字'.repeat(201);

    const input: UpdateProfileInput = { bio: longBio };

    await expect(service.updateProfile(userId, input)).rejects.toMatchObject({
      code: 'USER_INVALID_BIO',
      statusCode: 400,
    });
  });

  // -----------------------------------------------------------------------
  // 异常流程 — avatarUrl 校验
  // -----------------------------------------------------------------------

  it('should reject avatarUrl not starting with http:// or https://', async () => {
    // 业务规则: 必须以 http:// 或 https:// 开头的合法 URL
    // 来源: user.md §4 更新个人资料 - 错误码 USER_INVALID_AVATAR_URL
    const input: UpdateProfileInput = { avatarUrl: 'ftp://example.com/avatar.jpg' };

    await expect(service.updateProfile(userId, input)).rejects.toMatchObject({
      code: 'USER_INVALID_AVATAR_URL',
      statusCode: 400,
    });
  });

  it('should reject avatarUrl without protocol', async () => {
    // 业务规则: 必须以 http:// 或 https:// 开头的合法 URL
    // 来源: user.md §4 更新个人资料 - 错误码 USER_INVALID_AVATAR_URL
    const input: UpdateProfileInput = { avatarUrl: 'example.com/avatar.jpg' };

    await expect(service.updateProfile(userId, input)).rejects.toMatchObject({
      code: 'USER_INVALID_AVATAR_URL',
      statusCode: 400,
    });
  });

  it('should reject avatarUrl that is a plain string without URL structure', async () => {
    // 业务规则: 必须以 http:// 或 https:// 开头的合法 URL
    // 来源: user.md §4 更新个人资料 - 错误码 USER_INVALID_AVATAR_URL
    const input: UpdateProfileInput = { avatarUrl: 'not-a-url' };

    await expect(service.updateProfile(userId, input)).rejects.toMatchObject({
      code: 'USER_INVALID_AVATAR_URL',
      statusCode: 400,
    });
  });

  it('should reject empty avatarUrl string', async () => {
    // 业务规则: 必须以 http:// 或 https:// 开头的合法 URL
    // 来源: user.md §4 更新个人资料 - 错误码 USER_INVALID_AVATAR_URL
    const input: UpdateProfileInput = { avatarUrl: '' };

    await expect(service.updateProfile(userId, input)).rejects.toMatchObject({
      code: 'USER_INVALID_AVATAR_URL',
      statusCode: 400,
    });
  });
});

// ===========================================================================
// PUT /api/users/me/coach-role — UserService.updateCoachRole
// ===========================================================================

describe('PUT /api/users/me/coach-role — UserService.updateCoachRole', () => {
  let service: UserService;
  let repo: ReturnType<typeof createMockRepository>;

  const userId = 'user-uuid-1';

  beforeEach(() => {
    repo = createMockRepository();
    service = new UserService(repo as unknown as UserRepository);
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  it('should enable coach role for a non-coach user', async () => {
    // 业务规则: 开启教练角色后，用户同时具备普通用户和教练两种身份
    // 来源: user.md §4 开启教练角色 - 业务规则 bullet 1
    const user = createUserRecord({ isCoach: false });
    repo.findById.mockResolvedValue(user);
    const updatedUser = { ...user, isCoach: true };
    repo.updateCoachRole.mockResolvedValue(updatedUser);

    const result = await service.updateCoachRole(userId, true);

    expect(result.isCoach).toBe(true);
    expect(repo.updateCoachRole).toHaveBeenCalledWith(userId, true);
  });

  it('should be idempotent — calling with true when already a coach returns success', async () => {
    // 业务规则: 已经是教练的用户再次调用（isCoach = true）视为幂等操作
    // 来源: user.md §4 开启教练角色 - 业务规则 bullet 3
    const user = createUserRecord({ isCoach: true });
    repo.findById.mockResolvedValue(user);

    const result = await service.updateCoachRole(userId, true);

    expect(result.isCoach).toBe(true);
    expect(result.id).toBe(userId);
  });

  it('should mask phone number in response', async () => {
    // 业务规则: 响应中 phone 字段做脱敏处理
    // 来源: user.md §4 开启教练角色 - Response 200（phone 格式 138****1234）
    const user = createUserRecord({ phone: '13812345678', isCoach: false });
    repo.findById.mockResolvedValue(user);
    const updatedUser = { ...user, isCoach: true };
    repo.updateCoachRole.mockResolvedValue(updatedUser);

    const result = await service.updateCoachRole(userId, true);

    expect(result.phone).toBe('138****5678');
  });

  it('should return complete user fields in response', async () => {
    // 业务规则: 返回更新后的完整用户信息
    // 来源: user.md §4 开启教练角色 - Response 200
    const user = createUserRecord({ isCoach: false });
    repo.findById.mockResolvedValue(user);
    const updatedUser = { ...user, isCoach: true };
    repo.updateCoachRole.mockResolvedValue(updatedUser);

    const result = await service.updateCoachRole(userId, true);

    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('phone');
    expect(result).toHaveProperty('nickname');
    expect(result).toHaveProperty('avatarUrl');
    expect(result).toHaveProperty('bio');
    expect(result).toHaveProperty('isCoach');
    expect(result).toHaveProperty('createdAt');
  });

  // -----------------------------------------------------------------------
  // 异常流程
  // -----------------------------------------------------------------------

  it('should reject isCoach = false (closing coach role not supported)', async () => {
    // 业务规则: 一期不支持关闭教练角色，传入 isCoach = false 时返回 400 错误
    // 来源: user.md §4 开启教练角色 - 错误码 USER_COACH_ROLE_CLOSE_NOT_SUPPORTED
    await expect(service.updateCoachRole(userId, false)).rejects.toMatchObject({
      code: 'USER_COACH_ROLE_CLOSE_NOT_SUPPORTED',
      statusCode: 400,
    });
  });

  it('should reject when isCoach field is missing (undefined)', async () => {
    // 业务规则: isCoach 字段缺失时返回 400 错误
    // 来源: user.md §4 开启教练角色 - 错误码 USER_INVALID_COACH_ROLE
    await expect(
      service.updateCoachRole(userId, undefined as unknown as boolean),
    ).rejects.toMatchObject({
      code: 'USER_INVALID_COACH_ROLE',
      statusCode: 400,
    });
  });

  it('should reject when isCoach is a string instead of boolean', async () => {
    // 业务规则: isCoach 为非布尔值时返回 400 错误
    // 来源: user.md §4 开启教练角色 - 错误码 USER_INVALID_COACH_ROLE
    await expect(
      service.updateCoachRole(userId, 'true' as unknown as boolean),
    ).rejects.toMatchObject({
      code: 'USER_INVALID_COACH_ROLE',
      statusCode: 400,
    });
  });

  it('should reject when isCoach is a number instead of boolean', async () => {
    // 业务规则: isCoach 为非布尔值时返回 400 错误
    // 来源: user.md §4 开启教练角色 - 错误码 USER_INVALID_COACH_ROLE
    await expect(
      service.updateCoachRole(userId, 1 as unknown as boolean),
    ).rejects.toMatchObject({
      code: 'USER_INVALID_COACH_ROLE',
      statusCode: 400,
    });
  });
});

// ===========================================================================
// GET /api/users/:id — UserService.getUserPublicInfo
// ===========================================================================

describe('GET /api/users/:id — UserService.getUserPublicInfo', () => {
  let service: UserService;
  let repo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    repo = createMockRepository();
    service = new UserService(repo as unknown as UserRepository);
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  it('should return public info for an existing user', async () => {
    // 业务规则: 任何已登录用户均可查看其他用户的公开信息
    // 来源: user.md §4 获取用户公开信息 - 业务规则 bullet 2
    const user = createUserRecord();
    repo.findById.mockResolvedValue(user);

    const result = await service.getUserPublicInfo('user-uuid-1');

    expect(result).toBeDefined();
    expect(result.id).toBe('user-uuid-1');
    expect(result.nickname).toBe('测试用户');
    expect(result.avatarUrl).toBe('https://example.com/avatar.jpg');
    expect(result.bio).toBe('打球爱好者');
    expect(result.isCoach).toBe(false);
    expect(result.createdAt).toBeDefined();
  });

  it('should NOT include phone field in public info (privacy protection)', async () => {
    // 业务规则: 公开信息不包含 phone 字段（隐私保护）
    // 来源: user.md §4 获取用户公开信息 - 业务规则 bullet 1
    const user = createUserRecord({ phone: '13812345678' });
    repo.findById.mockResolvedValue(user);

    const result = await service.getUserPublicInfo('user-uuid-1');

    expect(result).not.toHaveProperty('phone');
  });

  it('should return public info for a coach user', async () => {
    // 业务规则: 返回 isCoach 字段
    // 来源: user.md §4 获取用户公开信息 - Response 200
    const user = createUserRecord({ isCoach: true });
    repo.findById.mockResolvedValue(user);

    const result = await service.getUserPublicInfo('user-uuid-1');

    expect(result.isCoach).toBe(true);
  });

  it('should return correct fields in response (id, nickname, avatarUrl, bio, isCoach, createdAt)', async () => {
    // 业务规则: 公开信息字段列表
    // 来源: user.md §4 获取用户公开信息 - Response 200
    const user = createUserRecord();
    repo.findById.mockResolvedValue(user);

    const result = await service.getUserPublicInfo('user-uuid-1');

    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('nickname');
    expect(result).toHaveProperty('avatarUrl');
    expect(result).toHaveProperty('bio');
    expect(result).toHaveProperty('isCoach');
    expect(result).toHaveProperty('createdAt');
  });

  // -----------------------------------------------------------------------
  // 异常流程
  // -----------------------------------------------------------------------

  it('should throw USER_NOT_FOUND when user does not exist', async () => {
    // 业务规则: 用户不存在返回 404
    // 来源: user.md §4 获取用户公开信息 - 错误码 USER_NOT_FOUND
    repo.findById.mockResolvedValue(null);

    await expect(service.getUserPublicInfo('nonexistent-uuid')).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
      statusCode: 404,
    });
  });
});

// ===========================================================================
// 内部接口 — UserService.getUserById (跨模块 Service 调用)
// ===========================================================================

describe('UserService.getUserById — 跨模块 Service 调用', () => {
  let service: UserService;
  let repo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    repo = createMockRepository();
    service = new UserService(repo as unknown as UserRepository);
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  it('should return user basic info (without phone) when user exists', async () => {
    // 业务规则: 返回字段不包含敏感信息（不返回 phone）
    // 来源: user.md §4 内部接口 getUserById - 业务规则 bullet 2
    const user = createUserRecord();
    repo.findById.mockResolvedValue(user);

    const result = await service.getUserById('user-uuid-1');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('user-uuid-1');
    expect(result!.nickname).toBe('测试用户');
    expect(result!.avatarUrl).toBe('https://example.com/avatar.jpg');
    expect(result!.bio).toBe('打球爱好者');
    expect(result!.isCoach).toBe(false);
    // Must NOT include phone
    expect(result).not.toHaveProperty('phone');
  });

  it('should include bio field for profile aggregation scenarios', async () => {
    // 业务规则: 包含 bio 字段，供个人主页等聚合场景使用
    // 来源: user.md §4 内部接口 getUserById - 业务规则 bullet 3
    const user = createUserRecord({ bio: '资深球友' });
    repo.findById.mockResolvedValue(user);

    const result = await service.getUserById('user-uuid-1');

    expect(result).not.toBeNull();
    expect(result!.bio).toBe('资深球友');
  });

  it('should return null when user does not exist', async () => {
    // 业务规则: 用户不存在时返回 null（由调用方决定如何处理）
    // 来源: user.md §4 内部接口 getUserById - 业务规则 bullet 1
    repo.findById.mockResolvedValue(null);

    const result = await service.getUserById('nonexistent-uuid');

    expect(result).toBeNull();
  });

  it('should NOT throw when user does not exist', async () => {
    // 业务规则: 用户不存在时返回 null，不抛错
    // 来源: user.md §4 内部接口 getUserById - 错误码表"无"
    repo.findById.mockResolvedValue(null);

    await expect(service.getUserById('nonexistent-uuid')).resolves.toBeNull();
  });

  it('should return correct structure matching UserPublicInfo type', async () => {
    // 业务规则: 返回值结构 { id, nickname, avatarUrl, bio, isCoach }
    // 来源: user.md §4 内部接口 getUserById - 返回值
    const user = createUserRecord();
    repo.findById.mockResolvedValue(user);

    const result = await service.getUserById('user-uuid-1');

    expect(result).not.toBeNull();
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('nickname');
    expect(result).toHaveProperty('avatarUrl');
    expect(result).toHaveProperty('bio');
    expect(result).toHaveProperty('isCoach');
  });
});

// ===========================================================================
// 内部接口 — UserService.getUsersByIds (跨模块 Service 调用)
// ===========================================================================

describe('UserService.getUsersByIds — 跨模块 Service 调用', () => {
  let service: UserService;
  let repo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    repo = createMockRepository();
    service = new UserService(repo as unknown as UserRepository);
  });

  // -----------------------------------------------------------------------
  // 正常流程
  // -----------------------------------------------------------------------

  it('should return user info for multiple existing users', async () => {
    // 业务规则: 根据用户 ID 列表批量获取用户基本信息
    // 来源: user.md §4 内部接口 getUsersByIds - 描述
    const users = [
      createUserRecord({ id: 'user-1', nickname: '用户一' }),
      createUserRecord({ id: 'user-2', nickname: '用户二' }),
    ];
    repo.findByIds.mockResolvedValue(users);

    const result = await service.getUsersByIds(['user-1', 'user-2']);

    expect(result).toHaveLength(2);
    expect(result.map((u) => u.id)).toContain('user-1');
    expect(result.map((u) => u.id)).toContain('user-2');
  });

  it('should return items without phone field', async () => {
    // 业务规则: 返回字段不包含敏感信息（与 getUserById 一致）
    // 来源: user.md §4 内部接口 getUsersByIds - 返回值（同 getUserById 结构）
    const users = [createUserRecord({ id: 'user-1' })];
    repo.findByIds.mockResolvedValue(users);

    const result = await service.getUsersByIds(['user-1']);

    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty('phone');
    expect(result[0]).toHaveProperty('id');
    expect(result[0]).toHaveProperty('nickname');
    expect(result[0]).toHaveProperty('avatarUrl');
    expect(result[0]).toHaveProperty('bio');
    expect(result[0]).toHaveProperty('isCoach');
  });

  it('should exclude non-existent IDs from result (no error)', async () => {
    // 业务规则: 不存在的 ID 不会出现在返回列表中（不报错）
    // 来源: user.md §4 内部接口 getUsersByIds - 业务规则 bullet 1
    const users = [createUserRecord({ id: 'user-1', nickname: '用户一' })];
    // Only user-1 exists, user-2 does not
    repo.findByIds.mockResolvedValue(users);

    const result = await service.getUsersByIds(['user-1', 'nonexistent-user']);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('user-1');
  });

  it('should return empty array for empty input array', async () => {
    // 业务规则: 空数组参数返回空数组
    // 来源: user.md §4 内部接口 getUsersByIds - 业务规则 bullet 2
    repo.findByIds.mockResolvedValue([]);

    const result = await service.getUsersByIds([]);

    expect(result).toEqual([]);
  });

  it('should NOT throw for any input (always returns result)', async () => {
    // 业务规则: 始终返回结果，不抛错
    // 来源: user.md §4 内部接口 getUsersByIds - 错误码表"无"
    repo.findByIds.mockResolvedValue([]);

    await expect(service.getUsersByIds([])).resolves.toBeDefined();
    await expect(service.getUsersByIds(['nonexistent'])).resolves.toBeDefined();
  });

  it('should return results where order is not guaranteed to match input', async () => {
    // 业务规则: 返回顺序不保证与输入一致
    // 来源: user.md §4 内部接口 getUsersByIds - 业务规则 bullet 3
    // We verify the contract allows any order — just check all items are present
    const users = [
      createUserRecord({ id: 'user-2', nickname: '用户二' }),
      createUserRecord({ id: 'user-1', nickname: '用户一' }),
    ];
    repo.findByIds.mockResolvedValue(users);

    const result = await service.getUsersByIds(['user-1', 'user-2']);

    expect(result).toHaveLength(2);
    const ids = result.map((u) => u.id);
    expect(ids).toContain('user-1');
    expect(ids).toContain('user-2');
  });
});
