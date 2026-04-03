import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  logLevel: process.env.LOG_LEVEL || 'info',
  adminPhones: (process.env.ADMIN_PHONES || '').split(',').filter(Boolean),
  mapApiKey: process.env.MAP_API_KEY || '',
  mapApiBaseUrl: process.env.MAP_API_BASE_URL || 'https://restapi.amap.com/v3',
  verificationCodeExpireMinutes: parseInt(process.env.VERIFICATION_CODE_EXPIRE_MINUTES || '5', 10),
  phoneLockDurationMinutes: parseInt(process.env.PHONE_LOCK_DURATION_MINUTES || '30', 10),
  phoneLockMaxFailures: parseInt(process.env.PHONE_LOCK_MAX_FAILURES || '5', 10),
  codeResendIntervalSeconds: parseInt(process.env.CODE_RESEND_INTERVAL_SECONDS || '60', 10),
};
