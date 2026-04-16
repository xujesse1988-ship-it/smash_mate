export interface SendCodeInput {
  phone: string;
}

export interface LoginInput {
  phone: string;
  code: string;
  isCoach?: boolean;
}

export interface UpdateProfileInput {
  nickname?: string;
  avatarUrl?: string;
  bio?: string;
}

export interface UpdateCoachRoleInput {
  isCoach: boolean;
}

export interface UserPublicInfo {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  bio: string | null;
  isCoach: boolean;
}

export interface WxLoginInput {
  code: string;
  encryptedData: string;
  iv: string;
  isCoach?: boolean;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    phone: string;
    nickname: string;
    avatarUrl: string | null;
    bio: string | null;
    isCoach: boolean;
    createdAt: Date;
  };
  isNewUser: boolean;
}
