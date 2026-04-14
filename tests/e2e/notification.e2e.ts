import { test, expect } from '@playwright/test';
import { login, register, logout, createActivity } from './helpers';

/**
 * E2E tests for notification flow (Issue #96).
 *
 * Phone numbers used: 13900000016 (activity creator),
 *                     13900000017 (joiner / notification receiver).
 *
 * Flow:
 * 1. Creator creates an activity
 * 2. Joiner joins the activity -> Creator gets notification
 * 3. Check unread badge, notification list, click-through, mark-all-read, filter
 */

const CREATOR_PHONE = '13900000016';
const JOINER_PHONE = '13900000017';

test.describe('Notification flow', () => {
  test.describe.configure({ mode: 'serial' });

  test('register creator and joiner', async ({ page }) => {
    await register(page, CREATOR_PHONE);
    await expect(page).toHaveURL(/\/activities/);
    await logout(page);

    await register(page, JOINER_PHONE);
    await expect(page).toHaveURL(/\/activities/);
    await logout(page);
  });

  test('creator creates an activity', async ({ page }) => {
    await login(page, CREATOR_PHONE);
    await createActivity(page, {
      venueKeyword: '羽毛球',
      maxParticipants: 4,
    });
    await page.waitForURL(/\/activities/, { timeout: 5000 });
  });

  test('joiner joins the activity to trigger notification', async ({ page }) => {
    await login(page, JOINER_PHONE);

    // Navigate to activity list
    await page.goto('/activities');
    await page.waitForLoadState('networkidle');

    // Click on the first activity
    const activityCard = page.locator('[style*="cursor: pointer"]').first();
    await activityCard.waitFor({ state: 'visible', timeout: 10000 });
    await activityCard.click();
    await page.waitForURL(/\/activities\//, { timeout: 5000 });

    // Join the activity
    const joinButton = page.getByRole('button', { name: '加入活动' });
    if (await joinButton.isVisible()) {
      await joinButton.click();
      // Wait for join to complete (participant count updates)
      await expect(page.getByText(/2.*人/)).toBeVisible({ timeout: 5000 });
    }
  });

  test('creator sees notification bell badge', async ({ page }) => {
    await login(page, CREATOR_PHONE);

    // Navigate to activities page (where the TopBar with bell is shown)
    await page.goto('/activities');
    await page.waitForLoadState('networkidle');

    // The notification bell should have an unread count badge
    // Ant Design Badge renders the count in a sup element
    const badge = page.locator('.ant-badge-count, .ant-scroll-number');
    // Wait a moment for the unread count to load
    await expect(badge).toBeVisible({ timeout: 10000 });
  });

  test('creator opens notification list and sees join notification', async ({ page }) => {
    await login(page, CREATOR_PHONE);

    // Navigate to notifications page
    await page.goto('/notifications');
    await page.waitForLoadState('networkidle');

    // Should see the notification page title
    await expect(page.getByText('通知').first()).toBeVisible({ timeout: 5000 });

    // Should see a notification about someone joining the activity
    // The template is: "{用户昵称} 加入了你的活动「{球馆名称} {开始日期}」"
    await expect(page.getByText(/加入了你的活动/)).toBeVisible({
      timeout: 10000,
    });
  });

  test('notification list shows filter tabs', async ({ page }) => {
    await login(page, CREATOR_PHONE);

    await page.goto('/notifications');
    await page.waitForLoadState('networkidle');

    // Should see filter tabs
    await expect(page.getByText('全部')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('未读')).toBeVisible();
    await expect(page.getByText('已读')).toBeVisible();
  });

  test('click unread filter shows only unread notifications', async ({ page }) => {
    await login(page, CREATOR_PHONE);

    await page.goto('/notifications');
    await page.waitForLoadState('networkidle');

    // Click "未读" filter
    await page.getByText('未读').click();

    // Should still see the join notification (it is unread)
    await expect(page.getByText(/加入了你的活动/)).toBeVisible({
      timeout: 5000,
    });
  });

  test('click notification navigates to target page', async ({ page }) => {
    await login(page, CREATOR_PHONE);

    await page.goto('/notifications');
    await page.waitForLoadState('networkidle');

    // Click on the notification
    const notification = page.getByText(/加入了你的活动/).first();
    await notification.click();

    // Should navigate to activity detail page
    await page.waitForURL(/\/activities\//, { timeout: 5000 });

    // Should see the activity detail
    await expect(page.getByText('约球详情')).toBeVisible({ timeout: 5000 });
  });

  test('mark all as read clears badge', async ({ page }) => {
    await login(page, CREATOR_PHONE);

    await page.goto('/notifications');
    await page.waitForLoadState('networkidle');

    // "全部已读" button should be visible when there are unread notifications
    const markAllReadBtn = page.getByText('全部已读');
    if (await markAllReadBtn.isVisible()) {
      await markAllReadBtn.click();

      // Wait for the button to disappear (all marked as read)
      await expect(markAllReadBtn).not.toBeVisible({ timeout: 5000 });
    }

    // Navigate back to a page with TopBar
    await page.goto('/activities');
    await page.waitForLoadState('networkidle');

    // The badge should no longer show a count (or show 0)
    // Ant Design Badge hides when count is 0
    const badge = page.locator('.ant-badge-count:visible, .ant-scroll-number:visible');
    // Badge should not be visible or should show 0
    const badgeCount = await badge.count();
    if (badgeCount > 0) {
      // If visible, the text should be "0" or not contain a number > 0
      const text = await badge.first().textContent();
      expect(text === '0' || text === '').toBeTruthy();
    }
  });

  test('read filter shows read notifications', async ({ page }) => {
    await login(page, CREATOR_PHONE);

    await page.goto('/notifications');
    await page.waitForLoadState('networkidle');

    // Click "已读" filter
    await page.getByText('已读').click();

    // Should see the previously read notification
    await expect(page.getByText(/加入了你的活动/)).toBeVisible({
      timeout: 5000,
    });
  });

  test('unread filter shows empty after mark-all-read', async ({ page }) => {
    await login(page, CREATOR_PHONE);

    await page.goto('/notifications');
    await page.waitForLoadState('networkidle');

    // Click "未读" filter
    await page.getByText('未读').click();

    // Should see "暂无通知" or empty state (all were marked read)
    // Give a moment for the filter to take effect
    await page.waitForTimeout(1000);

    const content = await page.locator('body').textContent();
    // Either show "暂无通知" or no notification items matching "加入了你的活动"
    const hasNoNotification = content?.includes('暂无通知');
    const hasJoinNotification = content?.includes('加入了你的活动');
    // After marking all read, unread filter should not show the join notification
    expect(hasNoNotification || !hasJoinNotification).toBeTruthy();
  });
});
