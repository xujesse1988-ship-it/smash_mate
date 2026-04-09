import jwt from 'jsonwebtoken';
import { config } from '../../infra/config.js';
import { AppError } from '../../infra/error-handler.js';
import { createModuleLogger } from '../../infra/logger.js';
import { UserRepository } from './repository.js';
import type {
  SendCodeInput,
  LoginInput,
  LoginResponse,
  UpdateProfileInput,
  UserPublicInfo,
} from './types.js';

const logger = createModuleLogger('user');

// Phone number validation: 11 digits starting with 1
const PHONE_REGEX = /^1\d{10}$/;
// Verification code format: exactly 6 digits
const CODE_REGEX = /^\d{6}$/;

/**
 * Mask phone number: 13812345678 -> 138****5678
 */
function maskPhone(phone: string): string {
  return phone.slice(0, 3) + '****' + phone.slice(7);
}

/**
 * Generate a random 6-digit verification code
 */
function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Generate a random nickname: 球友 + 5 random digits
 */
function generateNickname(): string {
  const digits = String(Math.floor(10000 + Math.random() * 90000));
  return `球友${digits}`;
}

export class UserService {
  private repo: UserRepository;

  constructor(repo: UserRepository) {
    this.repo = repo;
  }

  async sendCode(input: SendCodeInput): Promise<{ message: string }> {
    const { phone } = input;

    // 1. Validate phone format
    if (!PHONE_REGEX.test(phone)) {
      throw new AppError(400, 'AUTH_INVALID_PHONE', '手机号格式不合法');
    }

    // 2. Check phone lock
    const phoneLock = await this.repo.findOrCreatePhoneLock(phone);
    if (phoneLock.lockedUntil && phoneLock.lockedUntil > new Date()) {
      throw new AppError(429, 'AUTH_PHONE_LOCKED', '该手机号已被锁定，请稍后再试');
    }

    // 3. Check rate limit
    const latestCode = await this.repo.findLatestVerificationCode(phone);
    if (latestCode) {
      const elapsed = Date.now() - latestCode.createdAt.getTime();
      if (elapsed < config.codeResendIntervalSeconds * 1000) {
        throw new AppError(429, 'AUTH_CODE_RATE_LIMITED', '验证码发送过于频繁，请稍后再试');
      }
    }

    // 4. Generate verification code (use dev code if configured)
    const code = config.devVerificationCode || generateCode();
    const expiresAt = new Date(Date.now() + config.verificationCodeExpireMinutes * 60 * 1000);

    // 5. Store verification code
    await this.repo.createVerificationCode({ phone, code, expiresAt });

    // 6. Log (phone masked, code only at debug level)
    logger.info({ phone: maskPhone(phone) }, '验证码已发送');
    logger.debug({ phone: maskPhone(phone), code }, '验证码详情（仅开发环境）');

    return { message: '验证码已发送' };
  }

  async login(input: LoginInput): Promise<LoginResponse> {
    const { phone, code, isCoach } = input;

    // 1. Validate phone format
    if (!PHONE_REGEX.test(phone)) {
      throw new AppError(400, 'AUTH_INVALID_PHONE', '手机号格式不合法');
    }

    // 2. Validate code format
    if (!CODE_REGEX.test(code)) {
      throw new AppError(400, 'AUTH_INVALID_CODE', '验证码格式不合法');
    }

    // 3. Check phone lock
    const phoneLock = await this.repo.findOrCreatePhoneLock(phone);
    if (phoneLock.lockedUntil && phoneLock.lockedUntil > new Date()) {
      throw new AppError(429, 'AUTH_PHONE_LOCKED', '该手机号已被锁定，请稍后再试');
    }

    // 4. Verify code
    // Dev shortcut: if DEV_VERIFICATION_CODE is set and matches, skip DB lookup
    const isDevCodeMatch = config.devVerificationCode && code === config.devVerificationCode;

    if (!isDevCodeMatch) {
      // Normal flow: verify against DB (only unused codes are valid for login)
      const latestCode = await this.repo.findLatestVerificationCode(phone, true);

      // No unused verification code found
      if (!latestCode) {
        await this.incrementFailCount(phoneLock.id, phoneLock.failCount);
        throw new AppError(401, 'AUTH_CODE_WRONG', '验证码错误');
      }

      // Code expired
      if (latestCode.expiresAt < new Date()) {
        throw new AppError(401, 'AUTH_CODE_EXPIRED', '验证码已过期');
      }

      // Code mismatch
      if (latestCode.code !== code) {
        await this.incrementFailCount(phoneLock.id, phoneLock.failCount);
        throw new AppError(401, 'AUTH_CODE_WRONG', '验证码错误');
      }

      // 5. Code matches - mark used and reset phone lock
      await this.repo.markVerificationCodeUsed(latestCode.id);
    }

    await this.repo.updatePhoneLock(phoneLock.id, { failCount: 0, lockedUntil: null });

    // 6. Find or create user
    let user = await this.repo.findByPhone(phone);
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = await this.repo.create({
        phone,
        nickname: generateNickname(),
        isCoach: isCoach ?? false,
      });
    }

    // 7. Sign JWT
    const token = jwt.sign({ userId: user.id, role: 'user' }, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn,
    });

    // 8. Return response
    return {
      token,
      user: {
        id: user.id,
        phone: maskPhone(user.phone),
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        isCoach: user.isCoach,
        createdAt: user.createdAt,
      },
      isNewUser,
    };
  }

  async getCurrentUser(userId: string) {
    const user = await this.repo.findById(userId);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', '用户不存在');
    }
    return {
      id: user.id,
      phone: maskPhone(user.phone),
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      isCoach: user.isCoach,
      createdAt: user.createdAt,
    };
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    // 1. Validate nickname if provided
    if (input.nickname !== undefined) {
      if (
        typeof input.nickname !== 'string' ||
        input.nickname.length < 2 ||
        input.nickname.length > 20
      ) {
        throw new AppError(400, 'USER_INVALID_NICKNAME', '昵称长度需要在 2-20 个字符之间');
      }
    }

    // 2. Validate bio if provided
    if (input.bio !== undefined) {
      if (typeof input.bio !== 'string' || input.bio.length > 200) {
        throw new AppError(400, 'USER_INVALID_BIO', '个人简介不能超过 200 字符');
      }
    }

    // 3. Validate avatarUrl if provided
    if (input.avatarUrl !== undefined) {
      if (
        typeof input.avatarUrl !== 'string' ||
        (!input.avatarUrl.startsWith('http://') &&
          !input.avatarUrl.startsWith('https://') &&
          !input.avatarUrl.startsWith('/api/uploads/'))
      ) {
        throw new AppError(400, 'USER_INVALID_AVATAR_URL', '头像 URL 格式不合法');
      }
    }

    // 4. Build update data (only provided fields)
    const updateData: { nickname?: string; avatarUrl?: string; bio?: string } = {};
    if (input.nickname !== undefined) updateData.nickname = input.nickname;
    if (input.avatarUrl !== undefined) updateData.avatarUrl = input.avatarUrl;
    if (input.bio !== undefined) updateData.bio = input.bio;

    // 5. Update and return
    const updated = await this.repo.update(userId, updateData);
    return {
      id: updated.id,
      phone: maskPhone(updated.phone),
      nickname: updated.nickname,
      avatarUrl: updated.avatarUrl,
      bio: updated.bio,
      isCoach: updated.isCoach,
      createdAt: updated.createdAt,
    };
  }

  async updateCoachRole(userId: string, isCoach: boolean) {
    // 1. Validate isCoach field
    if (isCoach === undefined || isCoach === null || typeof isCoach !== 'boolean') {
      throw new AppError(400, 'USER_INVALID_COACH_ROLE', 'isCoach 字段必须为布尔值');
    }

    // 2. Reject closing coach role (Phase 1 limitation)
    if (isCoach === false) {
      throw new AppError(400, 'USER_COACH_ROLE_CLOSE_NOT_SUPPORTED', '一期不支持关闭教练角色');
    }

    // 3. Check if already a coach (idempotent)
    const user = await this.repo.findById(userId);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', '用户不存在');
    }

    if (user.isCoach) {
      // Already a coach, return current info (idempotent)
      return {
        id: user.id,
        phone: maskPhone(user.phone),
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        isCoach: user.isCoach,
        createdAt: user.createdAt,
      };
    }

    // 4. Enable coach role
    const updated = await this.repo.updateCoachRole(userId, true);
    return {
      id: updated.id,
      phone: maskPhone(updated.phone),
      nickname: updated.nickname,
      avatarUrl: updated.avatarUrl,
      bio: updated.bio,
      isCoach: updated.isCoach,
      createdAt: updated.createdAt,
    };
  }

  async getUserPublicInfo(id: string) {
    const user = await this.repo.findById(id);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', '用户不存在');
    }
    // Public info: no phone field
    return {
      id: user.id,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      isCoach: user.isCoach,
      createdAt: user.createdAt,
    };
  }

  async getAllUsers() {
    const users = await this.repo.findAllUsers();
    return users.map((user) => ({
      id: user.id,
      phone: maskPhone(user.phone),
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      isCoach: user.isCoach,
      createdAt: user.createdAt,
    }));
  }

  // --- Cross-module service methods ---

  async getUserById(id: string): Promise<UserPublicInfo | null> {
    const user = await this.repo.findById(id);
    if (!user) return null;
    return {
      id: user.id,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      isCoach: user.isCoach,
    };
  }

  async getUsersByIds(ids: string[]): Promise<UserPublicInfo[]> {
    const users = await this.repo.findByIds(ids);
    return users.map((u) => ({
      id: u.id,
      nickname: u.nickname,
      avatarUrl: u.avatarUrl,
      bio: u.bio,
      isCoach: u.isCoach,
    }));
  }

  // --- Private helpers ---

  private async incrementFailCount(phoneLockId: string, currentFailCount: number) {
    const newFailCount = currentFailCount + 1;
    const lockedUntil =
      newFailCount >= config.phoneLockMaxFailures
        ? new Date(Date.now() + config.phoneLockDurationMinutes * 60 * 1000)
        : null;
    await this.repo.updatePhoneLock(phoneLockId, {
      failCount: newFailCount,
      lockedUntil,
    });
  }
}
