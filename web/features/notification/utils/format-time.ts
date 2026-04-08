/**
 * Format a notification's createdAt timestamp to a relative time string.
 * Rules from web-app-notification.md §6.3:
 *   - < 1 minute: "刚刚"
 *   - 1-59 minutes: "{n} 分钟前"
 *   - 1-23 hours: "{n} 小时前"
 *   - 1-6 days: "{n} 天前"
 *   - 7+ days (same year): "MM-DD HH:mm"
 *   - Cross-year: "YYYY-MM-DD HH:mm"
 */
export function formatNotificationTime(createdAt: string): string {
  const now = new Date();
  const created = new Date(createdAt);
  const diffMs = now.getTime() - created.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) {
    return '刚刚';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} 分钟前`;
  }

  if (diffHours < 24) {
    return `${diffHours} 小时前`;
  }

  if (diffDays < 7) {
    return `${diffDays} 天前`;
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const month = pad(created.getUTCMonth() + 1);
  const day = pad(created.getUTCDate());
  const hours = pad(created.getUTCHours());
  const minutes = pad(created.getUTCMinutes());

  if (created.getUTCFullYear() !== now.getUTCFullYear()) {
    return `${created.getUTCFullYear()}-${month}-${day} ${hours}:${minutes}`;
  }

  return `${month}-${day} ${hours}:${minutes}`;
}
