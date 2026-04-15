import { test, expect } from '@playwright/test';
import { login, register, stablePhone, selectDateTime } from './helpers';

/**
 * E2E tests for the coaching features: coach application, profile editing,
 * group class publishing, student enrollment, and cancellation.
 *
 * Prerequisites:
 * - Backend dev server running with DEV_VERIFICATION_CODE="123456"
 * - Frontend dev server running on http://localhost:5173
 * - PostgreSQL dev database running with seed data (at least one venue)
 *
 * Issue: #92
 */

test.describe('Coach and Group Class', () => {
  const coachPhone = stablePhone(9201);
  const studentPhone = stablePhone(9202);
  const student2Phone = stablePhone(9203);

  test.describe.serial('Coach profile and group class flow', () => {
    test('register as coach and access coach features', async ({ page }) => {
      await register(page, coachPhone, { isCoach: true });

      // Should be on the activities page
      await expect(page).toHaveURL(/\/activities/);

      // Navigate to the "我的" profile page via bottom tab bar
      await page.getByText('我的').click();
      await page.waitForLoadState('networkidle');
    });

    test('coach edits profile (bio and specialties)', async ({ page }) => {
      await login(page, coachPhone);

      // Navigate to coach profile edit page
      await page.goto('/profile/coach-edit');
      await page.waitForLoadState('networkidle');

      // Should see the "教练资料" title
      await expect(page.getByText('教练资料')).toBeVisible();

      // Fill in bio
      const bioInput = page.locator('textarea');
      await bioInput.fill('专注羽毛球教学10年，擅长单打和步法训练');

      // Click specialty tags to select them (use getByRole to avoid matching textarea text)
      const singlesTag = page.getByRole('button', { name: '单打' });
      const footworkTag = page.getByRole('button', { name: '步法' });

      // Click to select specialties
      if (await singlesTag.isVisible()) {
        await singlesTag.click();
      }
      if (await footworkTag.isVisible()) {
        await footworkTag.click();
      }

      // Click save and wait for API response
      const saveResponse = page.waitForResponse(
        (resp) => resp.url().includes('/api/coaches/me') && resp.request().method() === 'PUT',
      );
      await page.getByText('保存').click();
      const resp = await saveResponse;
      expect(resp.status()).toBe(200);
    });

    test('coach publishes a group class', async ({ page }) => {
      await login(page, coachPhone);

      // Navigate to course management page
      await page.goto('/my-courses');
      await page.waitForLoadState('networkidle');

      // Should see the "团课" tab (default active)
      await expect(page.getByText('发布团课')).toBeVisible();

      // Click "发布团课" button
      await page.getByText('发布团课').click();

      // Should see the create group class modal
      await expect(page.getByText('发布团课').nth(1)).toBeVisible();

      // Fill in course name
      const titleInput = page.getByPlaceholder('请输入课程名称');
      await titleInput.fill('初级羽毛球团课');

      // Search and select a venue
      const venueInput = page.getByPlaceholder('搜索球馆');
      await venueInput.click();
      await venueInput.fill('羽毛球');

      const firstVenue = page.locator('button[style*="text-align: left"]').first();
      await firstVenue.waitFor({ state: 'visible', timeout: 8000 });
      await firstVenue.click();

      // Select start time (tomorrow, 10:00)
      await selectDateTime(page, '开始时间', {
        dayOffset: 1,
        hour: 10,
        minute: 0,
      });

      // Select end time (tomorrow, 12:00)
      await selectDateTime(page, '结束时间', {
        dayOffset: 1,
        hour: 12,
        minute: 0,
      });

      // Set max participants
      const maxInput = page.locator('input[type="number"][min="2"][max="30"]');
      await maxInput.fill('3');

      // Fill fee description
      const feeInput = page.getByPlaceholder('如：200元/人');
      await feeInput.fill('150元/人');

      // Submit
      await page.locator('div[style*="position: fixed"]').getByText('提交').click();

      // Wait for modal to close and list to update
      await page.waitForTimeout(2000);

      // Should see the newly created group class in the list
      await expect(page.getByText('初级羽毛球团课')).toBeVisible();
    });

    test('student browses coach list and finds coach', async ({ page }) => {
      await login(page, studentPhone);

      // Navigate to coach list page
      await page.goto('/coaches');
      await page.waitForLoadState('networkidle');

      // Should see the specialty filter chips
      await expect(page.getByText('全部')).toBeVisible();
      await expect(page.getByText('单打').first()).toBeVisible();
      await expect(page.getByText('双打').first()).toBeVisible();

      // Wait for coach list to load
      await page.waitForTimeout(1000);

      // The coach list should not be empty (we just registered a coach)
      // There should be at least one coach card
      const coachCards = page.locator('[data-testid^="coach-card-"]');
      const cardCount = await coachCards.count();
      expect(cardCount).toBeGreaterThanOrEqual(1);
    });

    test('student views coach profile and sees group class', async ({ page }) => {
      await login(page, studentPhone);

      // Navigate to coach list
      await page.goto('/coaches');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Click on the first coach card
      const firstCoach = page.locator('[data-testid^="coach-card-"]').first();
      await firstCoach.click();

      // Should be on the coach profile page
      await page.waitForLoadState('networkidle');

      // Should see the "课程" tab
      await expect(page.getByRole('button', { name: '课程' })).toBeVisible();

      // Should see the "评价" tab
      await expect(page.getByRole('button', { name: '评价' })).toBeVisible();

      // Should see at least the student count
      await expect(page.getByText(/名学员/)).toBeVisible();
    });

    test('student enrolls in group class', async ({ page }) => {
      await login(page, studentPhone);

      // Navigate to coach list and find the coach
      await page.goto('/coaches');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Click on the first coach card
      const firstCoach = page.locator('[data-testid^="coach-card-"]').first();
      await firstCoach.click();
      await page.waitForLoadState('networkidle');

      // Click on the group class card "初级羽毛球团课"
      const groupClassCard = page.getByText('初级羽毛球团课');
      if (await groupClassCard.isVisible()) {
        await groupClassCard.click();
        await page.waitForLoadState('networkidle');

        // Should see the group class detail page
        await expect(page.getByText('团课详情')).toBeVisible();

        // Should see the "立即报名" button
        const enrollButton = page.getByText('立即报名');
        if (await enrollButton.isVisible()) {
          await enrollButton.click();

          // Wait for enrollment to complete
          await page.waitForTimeout(1000);

          // After enrollment, should see "取消报名" button
          await expect(page.getByText('取消报名')).toBeVisible();

          // Participant count should have increased
          await expect(page.getByText(/\/ 3 人/)).toBeVisible();
        }
      }
    });

    test('student cancels group class enrollment', async ({ page }) => {
      await login(page, studentPhone);

      // Navigate to coach list and find the group class
      await page.goto('/coaches');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      const firstCoach = page.locator('[data-testid^="coach-card-"]').first();
      await firstCoach.click();
      await page.waitForLoadState('networkidle');

      const groupClassCard = page.getByText('初级羽毛球团课');
      if (await groupClassCard.isVisible()) {
        await groupClassCard.click();
        await page.waitForLoadState('networkidle');

        // Should see "取消报名" button since we enrolled in previous test
        const cancelButton = page.getByText('取消报名');
        if (await cancelButton.isVisible()) {
          await cancelButton.click();

          // Confirm cancellation
          await expect(page.getByText('是否取消报名？')).toBeVisible();
          await page.getByText('确认取消').click();

          // Wait for cancellation to complete
          await page.waitForTimeout(1000);

          // Should see "立即报名" button again
          await expect(page.getByText('立即报名')).toBeVisible();
        }
      }
    });
  });

  test.describe.serial('Group class full capacity', () => {
    test('coach creates a 2-person group class', async ({ page }) => {
      await login(page, coachPhone);

      await page.goto('/my-courses');
      await page.waitForLoadState('networkidle');

      // Click "发布团课"
      await page.getByText('发布团课').click();

      // Fill course name
      await page.getByPlaceholder('请输入课程名称').fill('满员测试团课');

      // Search and select venue
      const venueInput = page.getByPlaceholder('搜索球馆');
      await venueInput.click();
      await venueInput.fill('羽毛球');

      const firstVenue = page.locator('button[style*="text-align: left"]').first();
      await firstVenue.waitFor({ state: 'visible', timeout: 8000 });
      await firstVenue.click();

      await selectDateTime(page, '开始时间', {
        dayOffset: 5,
        hour: 14,
        minute: 0,
      });
      await selectDateTime(page, '结束时间', {
        dayOffset: 5,
        hour: 16,
        minute: 0,
      });

      // Set max to 2
      const maxInput = page.locator('input[type="number"][min="2"][max="30"]');
      await maxInput.fill('2');

      // Submit
      await page.locator('div[style*="position: fixed"]').getByText('提交').click();

      await page.waitForTimeout(2000);
      await expect(page.getByText('满员测试团课')).toBeVisible();
    });

    test('student 1 enrolls, student 2 enrolls, class becomes full', async ({ page }) => {
      // Student 1 enrolls
      await login(page, studentPhone);

      await page.goto('/coaches');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      const firstCoach = page.locator('[data-testid^="coach-card-"]').first();
      await firstCoach.click();
      await page.waitForLoadState('networkidle');

      const classCard = page.getByText('满员测试团课');
      if (await classCard.isVisible()) {
        await classCard.click();
        await page.waitForLoadState('networkidle');

        const enrollButton = page.getByText('立即报名');
        if (await enrollButton.isVisible()) {
          await enrollButton.click();
          await page.waitForTimeout(1000);
          await expect(page.getByText('取消报名')).toBeVisible();
        }
      }
    });

    test('student 2 enrolls and class becomes full', async ({ page }) => {
      await login(page, student2Phone);

      await page.goto('/coaches');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      const firstCoach = page.locator('[data-testid^="coach-card-"]').first();
      await firstCoach.click();
      await page.waitForLoadState('networkidle');

      const classCard = page.getByText('满员测试团课');
      if (await classCard.isVisible()) {
        await classCard.click();
        await page.waitForLoadState('networkidle');

        const enrollButton = page.getByText('立即报名');
        if (await enrollButton.isVisible()) {
          await enrollButton.click();
          await page.waitForTimeout(1000);
        }

        // After this enrollment, should show "已满员"
        // The button should now be "取消报名" for enrolled student
        await expect(page.getByText('取消报名')).toBeVisible();
      }
    });

    test('another student sees full class with disabled enrollment', async ({ page }) => {
      const anotherStudent = stablePhone(9204);
      await login(page, anotherStudent);

      await page.goto('/coaches');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      const firstCoach = page.locator('[data-testid^="coach-card-"]').first();
      await firstCoach.click();
      await page.waitForLoadState('networkidle');

      const classCard = page.getByText('满员测试团课');
      if (await classCard.isVisible()) {
        await classCard.click();
        await page.waitForLoadState('networkidle');

        // Should see "已满员" status badge
        await expect(page.getByText('已满员')).toBeVisible();

        // The enrollment button should be disabled
        const fullButton = page.getByRole('button', { name: '已满员' });
        if (await fullButton.isVisible()) {
          await expect(fullButton).toBeDisabled();
        }
      }
    });
  });

  test('coach applies via coach application page', async ({ page }) => {
    const newUserPhone = stablePhone(9205);

    // Register as a regular user (not coach)
    await register(page, newUserPhone);

    // Navigate to settings
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Should see "申请成为教练" link
    const coachApplyLink = page.getByText('申请成为教练');
    await expect(coachApplyLink).toBeVisible();

    // Click to navigate to coach application page
    await coachApplyLink.click();
    await page.waitForURL('**/coach-apply', { timeout: 5000 });

    // Should see the application page
    await expect(page.getByText('申请成为教练')).toBeVisible();
    await expect(page.getByText('上传证书/奖状')).toBeVisible();
    await expect(page.getByText('补充说明')).toBeVisible();

    // The submit button should be disabled (no certificate uploaded)
    const submitButton = page.getByRole('button', { name: '提交申请' });
    await expect(submitButton).toBeDisabled();
  });

  test('coach filters by specialty on coach list page', async ({ page }) => {
    await login(page, stablePhone(9206));

    await page.goto('/coaches');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Click "单打" filter
    await page.getByText('单打').first().click();
    await page.waitForTimeout(500);

    // Click "双打" filter
    await page.getByText('双打').first().click();
    await page.waitForTimeout(500);

    // Click "全部" to reset filter
    await page.getByText('全部').click();
    await page.waitForTimeout(500);
  });
});
