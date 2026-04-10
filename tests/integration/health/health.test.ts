/**
 * L1 集成测试: health 接口
 * 覆盖接口: GET /api/health
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '@server/app.js';

describe('GET /api/health', () => {
  it('should return ok status without authentication', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
