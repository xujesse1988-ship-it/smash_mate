/**
 * 契约测试: web-app/profile — uploadAvatar API
 * 覆盖接口: POST /api/upload/avatar
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { uploadAvatar } from '@web/features/profile/api/profile-api';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
});
afterAll(() => server.close());

describe('uploadAvatar API', () => {
  it('should send multipart request to /api/upload/avatar with auth token', async () => {
    localStorage.setItem('token', 'test-jwt-token');

    let capturedPath = '';
    let capturedAuth = '';

    server.use(
      http.post('/api/upload/avatar', ({ request }) => {
        capturedPath = new URL(request.url).pathname;
        capturedAuth = request.headers.get('authorization') ?? '';

        return HttpResponse.json({
          data: { avatarUrl: '/api/uploads/avatars/test-avatar.jpg' },
        });
      }),
    );

    const file = new File(['avatar'], 'avatar.jpg', { type: 'image/jpeg' });
    const result = await uploadAvatar(file);

    expect(capturedPath).toBe('/api/upload/avatar');
    expect(capturedAuth).toBe('Bearer test-jwt-token');
    expect(result).toBe('/api/uploads/avatars/test-avatar.jpg');
  });

  it('should throw structured error when upload fails', async () => {
    server.use(
      http.post('/api/upload/avatar', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'UPLOAD_INVALID_FILE_TYPE',
              message: '仅支持 JPEG、PNG、GIF、WebP 格式的图片',
            },
          },
          { status: 400 },
        );
      }),
    );

    const file = new File(['avatar'], 'avatar.txt', { type: 'text/plain' });

    await expect(uploadAvatar(file)).rejects.toMatchObject({
      code: 'UPLOAD_INVALID_FILE_TYPE',
    });
  });
});
