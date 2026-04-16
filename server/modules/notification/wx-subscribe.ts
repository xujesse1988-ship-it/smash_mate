import { config } from '../../infra/config.js';
import { createModuleLogger } from '../../infra/logger.js';

const logger = createModuleLogger('wx-subscribe');

interface SubscribeMessageData {
  [key: string]: { value: string };
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
    // 1. 获取 access_token（简化版本，生产应缓存）
    const tokenRes = await fetch(
      `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${config.wxAppId}&secret=${config.wxAppSecret}`,
    );
    const tokenData = (await tokenRes.json()) as { access_token?: string; errcode?: number };
    if (!tokenData.access_token) {
      logger.error({ errcode: tokenData.errcode }, 'Failed to get wx access_token');
      return;
    }

    // 2. 发送订阅消息
    const msgRes = await fetch(
      `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${tokenData.access_token}`,
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
    logger.error({ err }, 'Failed to send wx subscribe message');
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
