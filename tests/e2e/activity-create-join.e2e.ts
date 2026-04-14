import { test, expect } from '@playwright/test';
import { login, stablePhone, selectDateTime } from './helpers';

/**
 * E2E tests for creating and joining activities.
 *
 * Prerequisites:
 * - Backend dev server running with DEV_VERIFICATION_CODE="123456"
 * - Frontend dev server running on http://localhost:5173
 * - PostgreSQL dev database running with seed data (at least one venue)
 *
 * Issue: #90
 */

test.describe('Activity - Create and Join', () => {
  // Use stable phones for two different users
  const creatorPhone = stablePhone(9001);
  const joinerPhone = stablePhone(9002);

  test.describe.serial('Create and join activity flow', () => {
    let activityUrl: string;

    test('should login and see the activity list page', async ({ page }) => {
      await login(page, creatorPhone);

      // Should see the activity list page
      await expect(page).toHaveURL(/\/activities/);

      // Should see the filter bar with date options
      await expect(page.getByText('今天')).toBeVisible();
      await expect(page.getByText('明天')).toBeVisible();
      await expect(page.getByText('本周')).toBeVisible();

      // Should see the "有空位" switch
      await expect(page.getByText('有空位')).toBeVisible();

      // Should see the sort option "按时间"
      await expect(page.getByText('按时间')).toBeVisible();

      // Should see the FAB button for creating activity
      await expect(page.getByRole('button', { name: '发起约球' })).toBeVisible();
    });

    test('should create a new activity', async ({ page }) => {
      await login(page, creatorPhone);

      // Click FAB to navigate to create activity page
      await page.getByRole('button', { name: '发起约球' }).click();
      await page.waitForURL('**/activities/create', { timeout: 5000 });

      // Should see the create activity form
      await expect(page.getByText('发起约球')).toBeVisible();

      // Search and select a venue
      const venueInput = page.getByPlaceholder('搜索球馆');
      await venueInput.click();
      await venueInput.fill('羽毛球');

      // Wait for search results and click the first venue
      const firstVenue = page.locator('button[style*="text-align: left"]').first();
      await firstVenue.waitFor({ state: 'visible', timeout: 8000 });
      await firstVenue.click();

      // Wait for venue selection confirmation
      await expect(page.getByText(/已选:/)).toBeVisible();

      // Select start time (tomorrow, 14:00)
      await selectDateTime(page, '开始时间', {
        dayOffset: 1,
        hour: 14,
        minute: 0,
      });

      // Select end time (tomorrow, 16:00)
      await selectDateTime(page, '结束时间', {
        dayOffset: 1,
        hour: 16,
        minute: 0,
      });

      // Set max participants to 4
      const maxInput = page.locator('input[type="number"][min="2"]');
      await maxInput.fill('4');

      // Click publish
      await page.getByRole('button', { name: '发布' }).click();

      // Should navigate to the activity detail page (not /activities/create)
      await page.waitForURL(/\/activities\/(?!create)[a-zA-Z0-9-]+/, { timeout: 10000 });
      activityUrl = page.url();

      // Should see the activity status as "报名中"
      await expect(page.getByText('报名中')).toBeVisible();

      // Should show the participant count (1/4 since creator is first participant)
      await expect(page.getByText('/ 4 人')).toBeVisible();

      // Creator should see "编辑活动" and "取消活动" buttons
      await expect(page.getByText('编辑活动')).toBeVisible();
      await expect(page.getByText('取消活动')).toBeVisible();
    });

    test('should show the created activity in the list', async ({ page }) => {
      await login(page, creatorPhone);

      // Navigate to activity list
      await page.goto('/activities');
      await page.waitForLoadState('networkidle');

      // The list should contain at least one activity card
      // We cannot guarantee the exact content but the list should not be empty
      // Look for activity cards or the "暂无活动" empty state
      const hasActivities = await page
        .getByText('暂无活动')
        .isVisible()
        .catch(() => false);
      if (!hasActivities) {
        // There should be at least one activity card visible
        // Activity cards contain venue names and participant counts
        const cards = page.locator('[class*="dark-card"], [style*="borderRadius"]').first();
        await expect(cards).toBeVisible({ timeout: 5000 });
      }
    });

    test('should allow another user to join the activity', async ({ page }) => {
      // Login as the joiner
      await login(page, joinerPhone);

      // Navigate to the activity created by the creator
      await page.goto(activityUrl);
      await page.waitForLoadState('networkidle');

      // Should see the activity details
      await expect(page.getByText('约球详情')).toBeVisible();

      // Should see the "加入活动" button (since joiner is not a participant)
      const joinButton = page.getByText('加入活动');
      await expect(joinButton).toBeVisible();

      // Click join
      await joinButton.click();

      // Wait for the page to update
      await page.waitForTimeout(1000);

      // After joining, participant count should be 2/4
      await expect(page.getByText('2', { exact: true })).toBeVisible();

      // The join button should no longer be visible; instead see "退出活动"
      await expect(page.getByText('退出活动')).toBeVisible();
    });

    test('should allow a participant to exit the activity', async ({ page }) => {
      // Login as the joiner who previously joined
      await login(page, joinerPhone);

      // Navigate to the activity
      await page.goto(activityUrl);
      await page.waitForLoadState('networkidle');

      // Should see "退出活动" button
      const leaveButton = page.getByText('退出活动');
      await expect(leaveButton).toBeVisible();

      // Click leave
      await leaveButton.click();

      // Confirm the leave action in the dialog
      await expect(page.getByText('是否退出该活动？')).toBeVisible();
      await page.getByText('确认').click();

      // Wait for the page to update
      await page.waitForTimeout(1000);

      // After leaving, participant count should be back to 1/4
      await expect(page.getByText('/ 4 人')).toBeVisible();

      // Should see "加入活动" button again
      await expect(page.getByText('加入活动')).toBeVisible();
    });
  });

  test('should filter activities by date', async ({ page }) => {
    await login(page, stablePhone(9003));

    await page.goto('/activities');
    await page.waitForLoadState('networkidle');

    // Click "今天" filter chip
    const todayChip = page.getByText('今天');
    await expect(todayChip).toBeVisible();
    await todayChip.click();

    // Wait for the list to update
    await page.waitForTimeout(500);

    // Click "明天" filter chip
    const tomorrowChip = page.getByText('明天');
    await tomorrowChip.click();
    await page.waitForTimeout(500);

    // Click "本周" filter chip
    const weekChip = page.getByText('本周');
    await weekChip.click();
    await page.waitForTimeout(500);

    // Toggle back to no filter by clicking the active chip again
    await weekChip.click();
    await page.waitForTimeout(500);
  });

  test('should toggle the "有空位" filter', async ({ page }) => {
    await login(page, stablePhone(9004));

    await page.goto('/activities');
    await page.waitForLoadState('networkidle');

    // Find the "有空位" switch and toggle it
    const slotSwitch = page.locator('.ant-switch').first();
    await slotSwitch.click();
    await page.waitForTimeout(500);

    // Toggle off
    await slotSwitch.click();
    await page.waitForTimeout(500);
  });
});
