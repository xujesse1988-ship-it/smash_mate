import Taro from '@tarojs/taro'

// 订阅消息模板 ID（从微信后台获取后填入，暂用占位值）
const TEMPLATE_IDS = {
  activityUpdate: '', // 活动变更通知
  groupClassUpdate: '', // 课程变更通知
  privateLessonUpdate: '', // 预约状态通知
}

/**
 * 请求订阅消息
 * 在关键操作后调用，用户拒绝不阻塞流程
 */
export async function requestSubscribe(
  templateKeys: (keyof typeof TEMPLATE_IDS)[],
) {
  const tmplIds = templateKeys
    .map((key) => TEMPLATE_IDS[key])
    .filter((id) => id !== '')

  if (tmplIds.length === 0) return

  try {
    await Taro.requestSubscribeMessage({ tmplIds })
  } catch {
    // 用户拒绝或其他错误，静默处理
  }
}
