import { test, expect } from '@playwright/test';
import { login, stablePhone, selectDateTime } from './helpers';

/**
 * E2E tests for the activity lifecycle: edit, cancel, full capacity, status checks.
 *
 * Prerequisites:
 * - Backend dev server running with DEV_VERIFICATION_CODE="123456"
 * - Frontend dev server running on http://localhost:5173
 * - PostgreSQL dev database running with seed data
 *
 * Issue: #91
 */

test.describe('Activity - Lifecycle', () => {
  const creatorPhone = stablePhone(9101);
  const joiner1Phone = stablePhone(9102);
  const joiner2Phone = stablePhone(9103);

  test.describe.serial('Edit and cancel activity', () => {
    let activityUrl: string;

    test('creator creates an activity', async ({ page }) => {
      await login(page, creatorPhone);

      // Navigate to create activity page
      await page.goto('/activities/create');
      await page.waitForLoadState('networkidle');

      // Search and select a venue
      const venueInput = page.getByPlaceholder('搜索球馆');
      await venueInput.click();
      await venueInput.fill('羽毛球');

      const firstVenue = page.locator('button[style*="text-align: left"]').first();
      await firstVenue.waitFor({ state: 'visible', timeout: 8000 });
      await firstVenue.click();
      await expect(page.getByText(/已选:/)).toBeVisible();

      // Select start time (tomorrow, 18:00)
      await selectDateTime(page, '开始时间', {
        dayOffset: 1,
        hour: 18,
        minute: 0,
      });

      // Select end time (tomorrow, 20:00)
      await selectDateTime(page, '结束时间', {
        dayOffset: 1,
        hour: 20,
        minute: 0,
      });

      // Set max participants to 3 (small number to test full capacity)
      const maxInput = page.locator('input[type="number"][min="2"]');
      await maxInput.fill('3');

      // Click publish
      await page.getByRole('button', { name: '发布' }).click();

      // Should navigate to activity detail page
      await page.waitForURL(/\/activities\/(?!create)[a-zA-Z0-9-]+/, { timeout: 10000 });
      activityUrl = page.url();

      // Verify status
      await expect(page.getByText('报名中')).toBeVisible();
      await expect(page.getByText('/ 3 人')).toBeVisible();
    });

    test('creator modifies activity info', async ({ page }) => {
      await login(page, creatorPhone);
      await page.goto(activityUrl);
      await page.waitForLoadState('networkidle');

      // Click "编辑活动"
      await page.getByText('编辑活动').click();

      // Should be in edit mode - verify the edit form is visible
      await expect(page.getByText('保存')).toBeVisible();
      await expect(page.getByText('取消编辑')).toBeVisible();

      // Modify the max participants to 4
      const maxInput = page.locator('input[type="number"][min="2"][max="50"]');
      await maxInput.fill('4');

      // Save
      await page.getByText('保存').click();

      // Wait for the edit mode to close
      await page.waitForTimeout(1000);

      // Should show the updated participant limit
      await expect(page.getByText('/ 4 人')).toBeVisible();
    });

    test('creator cancels activity', async ({ page }) => {
      await login(page, creatorPhone);

      // Create a new activity for cancellation test
      await page.goto('/activities/create');
      await page.waitForLoadState('networkidle');

      const venueInput = page.getByPlaceholder('搜索球馆');
      await venueInput.click();
      await venueInput.fill('羽毛球');

      const firstVenue = page.locator('button[style*="text-align: left"]').first();
      await firstVenue.waitFor({ state: 'visible', timeout: 8000 });
      await firstVenue.click();
      await expect(page.getByText(/已选:/)).toBeVisible();

      await selectDateTime(page, '开始时间', {
        dayOffset: 2,
        hour: 10,
        minute: 0,
      });
      await selectDateTime(page, '结束时间', {
        dayOffset: 2,
        hour: 12,
        minute: 0,
      });

      await page.getByRole('button', { name: '发布' }).click();
      await page.waitForURL(/\/activities\/(?!create)[a-zA-Z0-9-]+/, { timeout: 10000 });

      // Should see "取消活动" button
      await expect(page.getByText('取消活动')).toBeVisible();

      // Click "取消活动"
      await page.getByText('取消活动').click();

      // Confirm dialog should appear
      await expect(page.getByText('取消后不可恢复，所有参与者将收到通知')).toBeVisible();

      // Click "确认" to confirm cancellation
      await page.getByText('确认').click();

      // Wait for the page to update
      await page.waitForTimeout(1000);

      // Should show "已取消" status
      await expect(page.getByText('已取消', { exact: true })).toBeVisible();

      // Should NOT show "编辑活动" or "取消活动" buttons anymore
      await expect(page.getByText('编辑活动')).not.toBeVisible();
      await expect(page.getByText('取消活动')).not.toBeVisible();
    });
  });

  test.describe.serial('Activity reaches max capacity', () => {
    let activityUrl: string;

    test('creator creates a 2-person activity', async ({ page }) => {
      await login(page, creatorPhone);

      await page.goto('/activities/create');
      await page.waitForLoadState('networkidle');

      const venueInput = page.getByPlaceholder('搜索球馆');
      await venueInput.click();
      await venueInput.fill('羽毛球');

      const firstVenue = page.locator('button[style*="text-align: left"]').first();
      await firstVenue.waitFor({ state: 'visible', timeout: 8000 });
      await firstVenue.click();
      await expect(page.getByText(/已选:/)).toBeVisible();

      await selectDateTime(page, '开始时间', {
        dayOffset: 3,
        hour: 9,
        minute: 0,
      });
      await selectDateTime(page, '结束时间', {
        dayOffset: 3,
        hour: 11,
        minute: 0,
      });

      // Set max to 2 (creator is #1, so only 1 more can join)
      const maxInput = page.locator('input[type="number"][min="2"]');
      await maxInput.fill('2');

      await page.getByRole('button', { name: '发布' }).click();
      await page.waitForURL(/\/activities\/(?!create)[a-zA-Z0-9-]+/, { timeout: 10000 });
      activityUrl = page.url();

      // Creator is participant #1
      await expect(page.getByText('/ 2 人')).toBeVisible();
    });

    test('joiner 1 joins and activity becomes full', async ({ page }) => {
      await login(page, joiner1Phone);

      await page.goto(activityUrl);
      await page.waitForLoadState('networkidle');

      // Join the activity
      const joinButton = page.getByText('加入活动');
      await expect(joinButton).toBeVisible();
      await joinButton.click();

      // Wait for update
      await page.waitForTimeout(1000);

      // Activity should now be full (2/2)
      await expect(page.getByText('/ 2 人')).toBeVisible();

      // Should see "退出活动" button now
      await expect(page.getByText('退出活动')).toBeVisible();
    });

    test('joiner 2 sees "已满员" and cannot join', async ({ page }) => {
      await login(page, joiner2Phone);

      await page.goto(activityUrl);
      await page.waitForLoadState('networkidle');

      // The join button should show "已满员" and be disabled
      const fullButton = page.getByRole('button', { name: '已满员' });
      await expect(fullButton).toBeVisible();
      await expect(fullButton).toBeDisabled();
    });

    test('joiner 1 leaves and activity returns to "报名中"', async ({ page }) => {
      await login(page, joiner1Phone);

      await page.goto(activityUrl);
      await page.waitForLoadState('networkidle');

      // Click "退出活动"
      await page.getByText('退出活动').click();

      // Confirm
      await expect(page.getByText('是否退出该活动？')).toBeVisible();
      await page.getByText('确认').click();

      // Wait for update
      await page.waitForTimeout(1000);

      // Should go back to "报名中"
      await expect(page.getByText('报名中')).toBeVisible();
    });
  });

  test('creator cannot exit their own activity', async ({ page }) => {
    await login(page, creatorPhone);

    // Create an activity
    await page.goto('/activities/create');
    await page.waitForLoadState('networkidle');

    const venueInput = page.getByPlaceholder('搜索球馆');
    await venueInput.click();
    await venueInput.fill('羽毛球');

    const firstVenue = page.locator('button[style*="text-align: left"]').first();
    await firstVenue.waitFor({ state: 'visible', timeout: 8000 });
    await firstVenue.click();
    await expect(page.getByText(/已选:/)).toBeVisible();

    await selectDateTime(page, '开始时间', {
      dayOffset: 4,
      hour: 15,
      minute: 0,
    });
    await selectDateTime(page, '结束时间', {
      dayOffset: 4,
      hour: 17,
      minute: 0,
    });

    await page.getByRole('button', { name: '发布' }).click();
    await page.waitForURL(/\/activities\/(?!create)[a-zA-Z0-9-]+/, { timeout: 10000 });

    // Creator should NOT see "退出活动" button
    // Instead they should see "编辑活动" and "取消活动"
    await expect(page.getByText('编辑活动')).toBeVisible();
    await expect(page.getByText('取消活动')).toBeVisible();
    await expect(page.getByText('退出活动')).not.toBeVisible();
  });
});
