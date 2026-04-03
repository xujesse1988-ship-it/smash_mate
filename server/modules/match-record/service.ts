import type {
  CreateMatchRecordInput,
  MatchRecordListQuery,
  UserMatchRecordQuery,
} from './types.js';

export class MatchRecordService {
  async createMatchRecord(_userId: string, _input: CreateMatchRecordInput) {
    throw new Error('Not implemented');
  }

  async deleteMatchRecord(_recordId: string, _userId: string) {
    throw new Error('Not implemented');
  }

  async getSourceMatchRecords(
    _sourceType: string,
    _sourceId: string,
    _query: MatchRecordListQuery,
  ) {
    throw new Error('Not implemented');
  }

  async getUserMatchRecords(_userId: string, _query: UserMatchRecordQuery) {
    throw new Error('Not implemented');
  }

  async getUserMatchStats(_userId: string) {
    throw new Error('Not implemented');
  }
}
