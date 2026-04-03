import type {
  SendCodeInput,
  LoginInput,
  LoginResponse,
  UpdateProfileInput,
  UserPublicInfo,
} from './types.js';

export class UserService {
  async sendCode(_input: SendCodeInput): Promise<{ message: string }> {
    throw new Error('Not implemented');
  }

  async login(_input: LoginInput): Promise<LoginResponse> {
    throw new Error('Not implemented');
  }

  async getCurrentUser(_userId: string) {
    throw new Error('Not implemented');
  }

  async updateProfile(_userId: string, _input: UpdateProfileInput) {
    throw new Error('Not implemented');
  }

  async updateCoachRole(_userId: string, _isCoach: boolean) {
    throw new Error('Not implemented');
  }

  async getUserPublicInfo(_id: string) {
    throw new Error('Not implemented');
  }

  // --- Cross-module service methods ---

  async getUserById(_id: string): Promise<UserPublicInfo | null> {
    throw new Error('Not implemented');
  }

  async getUsersByIds(_ids: string[]): Promise<UserPublicInfo[]> {
    throw new Error('Not implemented');
  }
}
