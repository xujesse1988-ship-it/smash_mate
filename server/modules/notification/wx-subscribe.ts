import { config } from '../../infra/config.js';
import { createModuleLogger } from '../../infra/logger.js';

const logger = createModuleLogger('wx-subscribe');

interface SubscribeMessageData {
  [key: string]: { value: string };
}

// In-memory access_token cache to avoid exceeding WeChat's 2000 calls/day limit
let cachedAccessToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  // Return cached token if still valid (with 200s safety margin)
  if (cachedAccessToken && Date.now() < cachedAccessToken.expiresAt) {
    return cachedAccessToken.token;
  }

  try {
    const tokenUrl = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${config.wxAppId}&secret=${config.wxAppSecret}`;
    const tokenRes = await fetch(tokenUrl, { signal: AbortSignal.timeout(5000) });
    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      expires_in?: number;
      errcode?: number;
    };

    if (!tokenData.access_token) {
      logger.error({ errcode: tokenData.errcode }, 'Failed to get wx access_token');
      return null;
    }

    // Cache with safety margin (200 seconds before actual expiry)
    cachedAccessToken = {
      token: tokenData.access_token,
      expiresAt: Date.now() + ((tokenData.expires_in || 7200) - 200) * 1000,
    };

    return cachedAccessToken.token;
  } catch (err) {
    logger.error({ message: (err as Error).message }, 'Failed to get wx access_token');
    return null;
  }
}

/**
 * 发送微信订阅消息
 * 失败不抛异常，只记录日志
 */
export async function sendWxSubscribeMessage(params: {
  openId: string;
  templateId: string;
  page?: string;
  data: SubscribeMessageData;
}): Promise<void> {
  const { openId, templateId, page, data } = params;

  if (!config.wxAppId || !config.wxAppSecret || !templateId) {
    return; // 未配置，静默跳过
  }

  try {
    // 1. 获取 access_token（带缓存）
    const accessToken = await getAccessToken();
    if (!accessToken) return;

    // 2. 发送订阅消息
    const msgRes = await fetch(
      `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          touser: openId,
          template_id: templateId,
          page: page || '',
          data,
        }),
      },
    );
    const msgData = (await msgRes.json()) as { errcode?: number; errmsg?: string };
    if (msgData.errcode && msgData.errcode !== 0) {
      logger.error(
        { errcode: msgData.errcode, errmsg: msgData.errmsg },
        'Failed to send wx subscribe message',
      );
    }
  } catch (err) {
    logger.error({ message: (err as Error).message }, 'Failed to send wx subscribe message');
  }
}

export function getTemplateIdByTargetType(targetType: string): string {
  switch (targetType) {
    case 'activity':
      return config.wxSubscribeTemplateActivity;
    case 'group-class':
      return config.wxSubscribeTemplateGroupClass;
    case 'private-lesson':
      return config.wxSubscribeTemplatePrivateLesson;
    default:
      return '';
  }
}

export function getPageByTargetType(targetType: string, targetId: string): string {
  switch (targetType) {
    case 'activity':
      return `pages/activity-detail/index?id=${targetId}`;
    case 'group-class':
      return `pages/group-class-detail/index?id=${targetId}`;
    case 'private-lesson':
      return `pages/private-lesson-detail/index?id=${targetId}`;
    default:
      return '';
  }
}
