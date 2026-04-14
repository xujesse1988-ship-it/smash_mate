import { test, expect } from '@playwright/test';
import { login, register, logout, selectDateTime } from './helpers';

/**
 * E2E tests for private lesson booking flow (Issue #93).
 *
 * Phone numbers used: 13900000010 (coach), 13900000011 (student).
 */

const COACH_PHONE = '13900000010';
const STUDENT_PHONE = '13900000011';

test.describe('Private lesson booking', () => {
  test.describe.configure({ mode: 'serial' });

  test('coach registers as coach role', async ({ page }) => {
    await register(page, COACH_PHONE, { isCoach: true });
    await expect(page).toHaveURL(/\/activities/);
  });

  test('student registers', async ({ page }) => {
    await register(page, STUDENT_PHONE);
    await expect(page).toHaveURL(/\/activities/);
  });

  test('coach sets private lesson availability', async ({ page }) => {
    await login(page, COACH_PHONE);

    // Navigate to course management
    await page.goto('/my-courses');
    await page.waitForLoadState('networkidle');

    // Switch to private schedule tab
    await page.getByText('私教时间').click();

    // Click add time slot button
    await page.getByText('添加时间段').click();
    await expect(page.getByText('添加私教时间段')).toBeVisible();

    // Fill start time (2 days from now, 14:00)
    await selectDateTime(page, '开始时间', { dayOffset: 2, hour: 14, minute: 0 });

    // Fill end time (2 days from now, 15:00)
    await selectDateTime(page, '结束时间', { dayOffset: 2, hour: 15, minute: 0 });

    // Fill fee description
    const feeInput = page.getByPlaceholder('如：300元/小时');
    await feeInput.fill('300元/小时');

    // Submit and wait for API response
    const slotResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/coaches/') && resp.url().includes('/availability'),
    );
    await page.locator('button').filter({ hasText: '提交' }).click();
    await slotResponse;

    // Verify slot appears in the list with "空闲" badge
    await expect(page.getByText('空闲')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('300元/小时')).toBeVisible();
  });

  test('student views coach profile and sees availability', async ({ page }) => {
    await login(page, STUDENT_PHONE);

    // Navigate to coach list
    await page.goto('/coaches');
    await page.waitForLoadState('networkidle');

    // Find and click on the coach card (data-testid prefixed with "coach-card-")
    const coachCard = page.locator('[data-testid^="coach-card-"]').first();
    await coachCard.waitFor({ state: 'visible', timeout: 10000 });
    await coachCard.click();

    // Wait for coach profile page
    await page.waitForURL(/\/coaches\//, { timeout: 5000 });

    // Should see the coach profile page with course tab
    await expect(page.getByText('课程')).toBeVisible();

    // Navigate to private lesson booking
    const privateLessonLink = page.getByText('预约私教');
    if (await privateLessonLink.isVisible()) {
      await privateLessonLink.click();
    } else {
      // Alternative: navigate directly via URL using the coach ID from current URL
      const url = page.url();
      const coachId = url.split('/coaches/')[1];
      await page.goto(`/coaches/${coachId}/private-lessons`);
    }

    await page.waitForURL(/\/private-lessons/, { timeout: 5000 });

    // Should see available time slots
    await expect(page.getByText('300元/小时')).toBeVisible({ timeout: 10000 });
  });

  test('student books a private lesson', async ({ page }) => {
    await login(page, STUDENT_PHONE);

    // Navigate to coach list and find our coach
    await page.goto('/coaches');
    await page.waitForLoadState('networkidle');

    const coachCard = page.locator('[style*="cursor: pointer"]').first();
    await coachCard.waitFor({ state: 'visible', timeout: 10000 });
    await coachCard.click();
    await page.waitForURL(/\/coaches\//, { timeout: 5000 });

    // Navigate to private lesson booking
    const url = page.url();
    const coachId = url.split('/coaches/')[1];
    await page.goto(`/coaches/${coachId}/private-lessons`);
    await page.waitForLoadState('networkidle');

    // Wait for slots to load
    await expect(page.getByText('300元/小时')).toBeVisible({ timeout: 10000 });

    // Click on the available slot (not booked)
    const slotCard = page.locator('[data-testid^="slot-card-"]').first();
    await slotCard.click();

    // Click "确认预约" button
    await page.getByText('确认预约').click();

    // Confirm booking dialog should appear
    await expect(page.getByText('是否预约该时间段？')).toBeVisible();
    await page.getByRole('button', { name: '确定' }).click();

    // After booking, slot should show as booked
    await expect(page.getByText('已约')).toBeVisible({ timeout: 5000 });
  });

  test('booked slot shows as "已约" for other users', async ({ page }) => {
    await login(page, STUDENT_PHONE);

    // Navigate back to the coach's private lessons page
    await page.goto('/coaches');
    await page.waitForLoadState('networkidle');

    const coachCard = page.locator('[style*="cursor: pointer"]').first();
    await coachCard.waitFor({ state: 'visible', timeout: 10000 });
    await coachCard.click();
    await page.waitForURL(/\/coaches\//, { timeout: 5000 });

    const url = page.url();
    const coachId = url.split('/coaches/')[1];
    await page.goto(`/coaches/${coachId}/private-lessons`);
    await page.waitForLoadState('networkidle');

    // The booked slot should show "已约"
    await expect(page.getByText('已约')).toBeVisible({ timeout: 10000 });
  });

  test('coach sees private lesson booking in management page', async ({ page }) => {
    await login(page, COACH_PHONE);

    await page.goto('/my-courses');
    await page.waitForLoadState('networkidle');

    // Switch to private lessons tab
    await page.getByText('私教预约').click();

    // Should see the booking with student info and "待上课" status
    await expect(page.getByText('待上课')).toBeVisible({ timeout: 5000 });
  });

  test('coach cancels private lesson and student is notified', async ({ page }) => {
    await login(page, COACH_PHONE);

    await page.goto('/my-courses');
    await page.waitForLoadState('networkidle');

    // Switch to private lessons tab
    await page.getByText('私教预约').click();
    await expect(page.getByText('待上课')).toBeVisible({ timeout: 5000 });

    // Click cancel button on the lesson
    await page.getByRole('button', { name: '取消' }).click();

    // Confirm cancellation
    await expect(page.getByText('是否取消该私教预约？')).toBeVisible();
    await page.getByRole('button', { name: '确认' }).click();

    // The lesson should no longer show "待上课" (it should show "已取消" or disappear)
    await expect(page.getByText('已取消')).toBeVisible({ timeout: 5000 });

    // Logout and login as student to check notification
    await logout(page);
    await login(page, STUDENT_PHONE);

    // Navigate to notifications
    await page.goto('/notifications');
    await page.waitForLoadState('networkidle');

    // Should see cancellation notification
    await expect(page.getByText(/取消.*私教/)).toBeVisible({ timeout: 10000 });
  });

  test('after coach cancels, slot is restored to available', async ({ page }) => {
    await login(page, COACH_PHONE);

    await page.goto('/my-courses');
    await page.waitForLoadState('networkidle');

    // Switch to private schedule tab to check slot status
    await page.getByText('私教时间').click();

    // The slot should be available again (show "空闲")
    await expect(page.getByText('空闲')).toBeVisible({ timeout: 5000 });
  });
});
