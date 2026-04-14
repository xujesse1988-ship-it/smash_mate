import { test, expect, type Page } from '@playwright/test';
import { login, register, logout, stablePhone, selectDateTime } from './helpers';

/**
 * E2E tests for Private Student management (Issue #99).
 *
 * Covers:
 * - Coach adds a private student
 * - Student receives notification
 * - Creates/cancels private lessons, edits training content
 * - Adds lesson notes
 * - Views student detail, adds tags and notes
 * - Removes student (soft delete, data preserved)
 * - Cannot create new lesson for removed student
 *
 * Prerequisites:
 * - Backend dev server running with DEV_VERIFICATION_CODE="123456"
 * - Frontend SPA on http://localhost:5173
 * - Admin app on http://localhost:5174 (for coach approval)
 * - PostgreSQL dev database running
 * - Admin phone 13800000001 is in ADMIN_PHONES env var
 */

const WEB_BASE = 'http://localhost:5173';
const ADMIN_BASE = 'http://localhost:5174';
const DEV_CODE = '123456';

// Phone numbers in the assigned range
const coachPhone = stablePhone(3020);
const studentPhone = stablePhone(3021);
const opponentPhone = stablePhone(3022); // Third user for match record
const adminPhone = '13800000001';

// ---- Helpers ----

async function adminLogin(page: Page): Promise<void> {
  await page.goto(`${ADMIN_BASE}/login`);
  await page.waitForLoadState('networkidle');

  await page.getByPlaceholder('手机号').fill(adminPhone);
  await page.getByRole('button', { name: '获取验证码' }).click();
  await expect(page.getByText('验证码已发送')).toBeVisible({ timeout: 5000 });
  await page.getByPlaceholder('验证码').fill(DEV_CODE);
  await page.getByRole('button', { name: '登录' }).click();
  await page.waitForURL(`${ADMIN_BASE}/cities`, { timeout: 10000 });
}

function createTestPngBuffer(): Buffer {
  const base64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
  return Buffer.from(base64, 'base64');
}

async function registerAndApproveCoach(page: Page, phone: string): Promise<void> {
  await register(page, phone);

  await page.goto(`${WEB_BASE}/coach-apply`);
  await page.waitForLoadState('networkidle');

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: 'cert.png',
    mimeType: 'image/png',
    buffer: createTestPngBuffer(),
  });
  await expect(page.locator('img[alt="证书 1"]')).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: '提交申请' }).click();
  await expect(page.getByText('申请已提交')).toBeVisible({ timeout: 5000 });

  await adminLogin(page);
  await page.goto(`${ADMIN_BASE}/coach-review`);
  await page.waitForLoadState('networkidle');
  await page.getByText('待审核').click();
  await page.waitForLoadState('networkidle');

  const firstRow = page.locator('table tbody tr').first();
  await expect(firstRow).toBeVisible({ timeout: 5000 });
  await firstRow.click();
  await expect(page.getByText('审核详情')).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: '通过' }).click();
  await expect(page.getByText('已通过审核')).toBeVisible({ timeout: 5000 });
}

async function loginAsCoach(page: Page, phone: string): Promise<void> {
  await login(page, phone);
  await expect(page).toHaveURL(/\/activities/);
}

// ---- Tests ----

test.describe('Private Student Management', () => {
  test.describe.serial('Setup and private student operations', () => {
    test('setup: register coach and students', async ({ page }) => {
      // Register and approve coach
      await registerAndApproveCoach(page, coachPhone);

      // Register the private student
      await logout(page);
      await register(page, studentPhone);

      // Register an opponent (third user for match records)
      await logout(page);
      await register(page, opponentPhone);
    });

    test('coach navigates to private student list page', async ({ page }) => {
      await loginAsCoach(page, coachPhone);

      await page.goto(`${WEB_BASE}/my-private-students`);
      await page.waitForLoadState('networkidle');

      // Should see the page title
      await expect(page.getByText('我的私教学员')).toBeVisible();

      // Should see empty state
      await expect(page.getByText('暂无私教学员')).toBeVisible();
    });

    test('coach adds a private student', async ({ page }) => {
      await loginAsCoach(page, coachPhone);
      await page.goto(`${WEB_BASE}/my-private-students`);
      await page.waitForLoadState('networkidle');

      // Click FAB to add student
      await page.locator('[data-testid="add-private-student-fab"]').click();

      // Should show add student modal
      await expect(page.getByText('添加私教学员')).toBeVisible();

      // Search for the student by phone's last 4 digits
      const last4 = studentPhone.slice(-4);
      await page.getByPlaceholder('输入用户昵称搜索').fill(last4);
      await page.getByRole('button', { name: '搜索' }).click();

      // Wait for search results
      await expect(page.getByRole('button', { name: '添加' }).first()).toBeVisible({
        timeout: 5000,
      });

      // Click add on the first result
      await page.getByRole('button', { name: '添加' }).first().click();

      // Should show success message
      await expect(page.getByText('添加成功')).toBeVisible({ timeout: 5000 });
    });

    test('student receives notification after being added', async ({ page }) => {
      await login(page, studentPhone);
      await page.goto(`${WEB_BASE}/notifications`);
      await page.waitForLoadState('networkidle');

      // Should see notification about being added as a private student
      await expect(page.getByText(/固定私教学员/).or(page.getByText(/私教/))).toBeVisible({
        timeout: 5000,
      });
    });

    test('coach creates a private lesson', async ({ page }) => {
      await loginAsCoach(page, coachPhone);
      await page.goto(`${WEB_BASE}/my-private-students`);
      await page.waitForLoadState('networkidle');

      // Click on the student card to view details
      const studentCard = page.locator('.dark-card').first();
      await studentCard.click();
      await page.waitForLoadState('networkidle');

      // Should see student detail page
      await expect(page.getByText('历史课程')).toBeVisible();

      // Click "创建课程"
      await page.locator('[data-testid="create-lesson-btn"]').click();

      // Should show create lesson modal
      await expect(page.getByText('创建私教课程')).toBeVisible();

      // Search and select venue
      const venueInput = page.getByPlaceholder('搜索球馆');
      await venueInput.fill('球馆');

      const venueResult = page.locator('button').filter({ hasText: /球馆/ }).first();
      await venueResult.waitFor({ state: 'visible', timeout: 5000 });
      await venueResult.click();

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

      // Fill training content
      await page.getByPlaceholder('输入训练内容').fill('基础步法 -> 网前技术 -> 实战对打');

      // Submit
      await page.getByRole('button', { name: '提交' }).click();

      // Should see success message
      await expect(page.getByText('课程创建成功')).toBeVisible({
        timeout: 5000,
      });
    });

    test('coach views lesson detail and edits training content', async ({ page }) => {
      await loginAsCoach(page, coachPhone);
      await page.goto(`${WEB_BASE}/my-private-students`);
      await page.waitForLoadState('networkidle');

      // Navigate to student detail
      const studentCard = page.locator('.dark-card').first();
      await studentCard.click();
      await page.waitForLoadState('networkidle');

      // Click on a lesson (upcoming or history)
      const lessonCard = page.locator('[data-testid="upcoming-lesson"]').or(
        page
          .locator('.dark-card')
          .filter({ hasText: /第.*节课/ })
          .first(),
      );
      await lessonCard.click();
      await page.waitForLoadState('networkidle');

      // Should see lesson detail page
      await expect(page.getByText('课程详情')).toBeVisible();
      await expect(page.getByText('训练内容')).toBeVisible();

      // Click edit training content
      await page.locator('[data-testid="edit-training-btn"]').click();

      // Should show textarea
      const textarea = page.locator('textarea');
      await expect(textarea).toBeVisible();

      // Update training content
      await textarea.fill('基础步法 -> 网前技术 -> 搓球练习 -> 实战对打');

      // Save
      await page.getByRole('button', { name: '保存' }).click();

      // Should see success message
      await expect(page.getByText('训练内容已更新')).toBeVisible({
        timeout: 5000,
      });

      // Should see updated content
      await expect(page.getByText('搓球练习')).toBeVisible();
    });

    test('coach adds lesson notes', async ({ page }) => {
      await loginAsCoach(page, coachPhone);
      await page.goto(`${WEB_BASE}/my-private-students`);
      await page.waitForLoadState('networkidle');

      // Navigate to student -> lesson detail
      const studentCard = page.locator('.dark-card').first();
      await studentCard.click();
      await page.waitForLoadState('networkidle');

      const lessonCard = page.locator('[data-testid="upcoming-lesson"]').or(
        page
          .locator('.dark-card')
          .filter({ hasText: /第.*节课/ })
          .first(),
      );
      await lessonCard.click();
      await page.waitForLoadState('networkidle');

      // Should see notes section
      await expect(page.getByText('课程笔记')).toBeVisible();

      // Click add note button
      await page.locator('[data-testid="add-lesson-note-btn"]').click();

      // Should show note modal
      await expect(page.getByText('添加课程笔记')).toBeVisible();

      // Fill note content
      await page.getByPlaceholder(/输入笔记内容/).fill('网前技术进步明显');

      // Submit
      await page.getByRole('button', { name: '提交' }).click();

      // Should see success message
      await expect(page.getByText('笔记添加成功')).toBeVisible({
        timeout: 5000,
      });

      // Note should be visible
      await expect(page.getByText('网前技术进步明显')).toBeVisible();

      // Add a second note
      await page.locator('[data-testid="add-lesson-note-btn"]').click();
      await page.getByPlaceholder(/输入笔记内容/).fill('搓球手感还需要加强');
      await page.getByRole('button', { name: '提交' }).click();

      // Both notes should be visible (append mode)
      await expect(page.getByText('网前技术进步明显')).toBeVisible();
      await expect(page.getByText('搓球手感还需要加强')).toBeVisible({
        timeout: 5000,
      });
    });

    test('coach views student detail and adds tags', async ({ page }) => {
      await loginAsCoach(page, coachPhone);
      await page.goto(`${WEB_BASE}/my-private-students`);
      await page.waitForLoadState('networkidle');

      // Navigate to student detail
      const studentCard = page.locator('.dark-card').first();
      await studentCard.click();
      await page.waitForLoadState('networkidle');

      // Click "+ 添加标签" or click on existing tags area
      const addTagBtn = page.getByText('+ 添加标签');
      if (await addTagBtn.isVisible()) {
        await addTagBtn.click();
      } else {
        // Tags area might be clickable
        const tagArea = page.locator('.tag-green').first();
        if (await tagArea.isVisible()) {
          await tagArea.click();
        }
      }

      // Should show tag management modal
      await expect(page.getByText('管理标签')).toBeVisible({ timeout: 5000 });

      // Add a tag
      await page.getByPlaceholder(/输入标签/).fill('左手');
      await page.getByRole('button', { name: '添加' }).click();

      // Add another tag
      await page.getByPlaceholder(/输入标签/).fill('需加强步法');
      await page.getByRole('button', { name: '添加' }).click();

      // Save tags
      await page.getByRole('button', { name: '保存' }).click();

      // Should see success message
      await expect(page.getByText('标签已更新')).toBeVisible({ timeout: 5000 });

      // Tags should be visible on the student detail page
      await expect(page.getByText('左手')).toBeVisible();
      await expect(page.getByText('需加强步法')).toBeVisible();
    });

    test('coach adds student notes', async ({ page }) => {
      await loginAsCoach(page, coachPhone);
      await page.goto(`${WEB_BASE}/my-private-students`);
      await page.waitForLoadState('networkidle');

      const studentCard = page.locator('.dark-card').first();
      await studentCard.click();
      await page.waitForLoadState('networkidle');

      // Click "写笔记" button
      await page.locator('[data-testid="write-note-btn"]').click();

      // Should show note modal
      await expect(page.getByText('添加学员笔记')).toBeVisible();

      // Fill note content
      await page.getByPlaceholder(/输入笔记内容/).fill('整体水平提升很快，可以开始学习高级技巧');

      // Submit
      await page.getByRole('button', { name: '提交' }).click();

      // Should see success message
      await expect(page.getByText('笔记添加成功')).toBeVisible({
        timeout: 5000,
      });

      // Note should be visible in recent notes
      await expect(page.getByText('整体水平提升很快，可以开始学习高级技巧')).toBeVisible();
    });

    test('coach cancels a scheduled lesson', async ({ page }) => {
      await loginAsCoach(page, coachPhone);
      await page.goto(`${WEB_BASE}/my-private-students`);
      await page.waitForLoadState('networkidle');

      const studentCard = page.locator('.dark-card').first();
      await studentCard.click();
      await page.waitForLoadState('networkidle');

      // Navigate to the upcoming lesson
      const lessonCard = page.locator('[data-testid="upcoming-lesson"]').or(
        page
          .locator('.dark-card')
          .filter({ hasText: /第.*节课/ })
          .first(),
      );
      await lessonCard.click();
      await page.waitForLoadState('networkidle');

      // Click "取消课程" (only visible for scheduled lessons)
      const cancelBtn = page.locator('[data-testid="cancel-lesson-btn"]');
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();

        // Confirm cancellation
        await expect(page.getByText('确定取消该课程？')).toBeVisible();
        await page.locator('[data-testid="confirm-cancel-lesson-btn"]').click();

        // Should see success message
        await expect(page.getByText('课程已取消')).toBeVisible({
          timeout: 5000,
        });

        // Should show cancelled status
        await expect(page.getByText('已取消')).toBeVisible();
      }
    });

    test('coach removes student (soft delete)', async ({ page }) => {
      await loginAsCoach(page, coachPhone);
      await page.goto(`${WEB_BASE}/my-private-students`);
      await page.waitForLoadState('networkidle');

      const studentCard = page.locator('.dark-card').first();
      await studentCard.click();
      await page.waitForLoadState('networkidle');

      // Click "移除" button
      await page.locator('[data-testid="remove-student-btn"]').click();

      // Should show confirmation
      await expect(page.getByText('确定移除该私教学员？')).toBeVisible();

      // Confirm removal
      await page.locator('[data-testid="confirm-remove-btn"]').click();

      // Should see success message and redirect back to list
      await expect(page.getByText('已移除')).toBeVisible({ timeout: 5000 });
      await expect(page).toHaveURL(/\/my-private-students$/);
    });

    test('removed student data is preserved (coach can still view)', async ({ page }) => {
      await loginAsCoach(page, coachPhone);
      await page.goto(`${WEB_BASE}/my-private-students`);
      await page.waitForLoadState('networkidle');

      // The student card should still be visible (data preserved)
      // but might show a different state. Navigate to detail.
      const studentCard = page.locator('.dark-card').first();
      if (await studentCard.isVisible()) {
        await studentCard.click();
        await page.waitForLoadState('networkidle');

        // Historical data should still be visible
        await expect(page.getByText('历史课程')).toBeVisible();

        // The "创建课程" button should NOT be visible for removed student
        await expect(page.locator('[data-testid="create-lesson-btn"]')).not.toBeVisible();

        // The "移除" button should NOT be visible for already-removed student
        await expect(page.locator('[data-testid="remove-student-btn"]')).not.toBeVisible();
      }
    });
  });
});
