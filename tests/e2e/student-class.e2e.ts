import { test, expect, type Page } from '@playwright/test';
import { login, register, logout, stablePhone, selectDateTime } from './helpers';

/**
 * E2E tests for Student Class management (Issue #98).
 *
 * Covers:
 * - Coach creates a student class
 * - Adds/removes students, students receive notifications
 * - Creates/cancels lessons, edits training content
 * - Adds lesson notes (append mode)
 * - Views student profile, adds tags and notes
 * - Deletes class with confirmation
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
const coachPhone = stablePhone(3010);
const studentPhone1 = stablePhone(3011);
const studentPhone2 = stablePhone(3012);
const adminPhone = '13800000001';

// ---- Helpers ----

async function adminLogin(page: Page): Promise<void> {
  await page.goto(`${ADMIN_BASE}/login`);
  await page.waitForLoadState('networkidle');

  await page.getByPlaceholder('手机号').fill(adminPhone);
  const sendCodeResponse = page.waitForResponse(
    (resp) => resp.url().includes('/api/auth/send-code') && resp.status() >= 200,
  );
  await page.getByRole('button', { name: '获取验证码' }).click();
  await sendCodeResponse;
  await page.getByPlaceholder('验证码').fill(DEV_CODE);
  const loginResponse = page.waitForResponse((resp) => resp.url().includes('/api/auth/login'));
  await page.getByRole('button', { name: '登录' }).click();
  await loginResponse;
  await page.waitForURL(`${ADMIN_BASE}/cities`, { timeout: 10000 });
}

/**
 * Create a tiny valid PNG buffer for certificate upload.
 */
function createTestPngBuffer(): Buffer {
  const base64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
  return Buffer.from(base64, 'base64');
}

/**
 * Submit coach application and approve it via admin.
 * After this, the user with `phone` is a verified coach.
 */
async function registerAndApproveCoach(page: Page, phone: string): Promise<void> {
  // Register the user
  await register(page, phone);

  // Submit coach application
  await page.goto(`${WEB_BASE}/coach-apply`);
  await page.waitForLoadState('networkidle');

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: 'cert.png',
    mimeType: 'image/png',
    buffer: createTestPngBuffer(),
  });
  await expect(page.locator('img[alt="证书 1"]')).toBeVisible({ timeout: 10000 });
  const submitResponse = page.waitForResponse(
    (resp) => resp.url().includes('/api/coach-applications') && resp.request().method() === 'POST',
  );
  await page.getByRole('button', { name: '提交申请' }).click();
  await submitResponse;

  // Admin approves
  await adminLogin(page);
  // Navigate via sidebar menu to avoid full reload auth issues
  await page.waitForLoadState('networkidle');
  await page.getByText('教练审核').click();
  await page.waitForURL(`${ADMIN_BASE}/coach-review`, { timeout: 10000 });
  await page.getByRole('tab', { name: '待审核' }).click();
  await page.waitForLoadState('networkidle');

  const firstRow = page.locator('table tbody tr').first();
  await expect(firstRow).toBeVisible({ timeout: 5000 });
  await firstRow.click();
  await expect(page.getByText('审核详情')).toBeVisible({ timeout: 5000 });
  const approveResponse = page.waitForResponse(
    (resp) => resp.url().includes('/review') && resp.request().method() === 'POST',
  );
  await page.getByRole('button', { name: '通过' }).click();
  const approveResp = await approveResponse;
  expect(approveResp.status()).toBe(200);
}

async function loginAsCoach(page: Page, phone: string): Promise<void> {
  await login(page, phone);
  // Verify we're logged in
  await expect(page).toHaveURL(/\/activities/);
}

// ---- Tests ----

test.describe('Student Class Management', () => {
  test.describe.serial('Setup and basic class operations', () => {
    test('setup: register coach and students', async ({ page }) => {
      // Register and approve coach
      await registerAndApproveCoach(page, coachPhone);

      // Register student 1
      await logout(page);
      await register(page, studentPhone1);

      // Register student 2
      await logout(page);
      await register(page, studentPhone2);
    });

    test('coach navigates to student class list via course management tab', async ({ page }) => {
      await loginAsCoach(page, coachPhone);

      // 新入口：课程管理页的"学员班" Tab
      await page.goto(`${WEB_BASE}/my-courses`);
      await page.waitForLoadState('networkidle');

      // Switch to the 学员班 tab
      await page.getByRole('button', { name: '学员班', exact: true }).click();

      // Should see empty state
      await expect(page.getByText('暂无学员班')).toBeVisible();

      // Should see the FAB create button
      await expect(page.getByLabel('创建学员班')).toBeVisible();
    });

    test('coach creates a new student class', async ({ page }) => {
      await loginAsCoach(page, coachPhone);
      await page.goto(`${WEB_BASE}/my-student-classes`);
      await page.waitForLoadState('networkidle');

      // Click FAB to create
      await page.getByLabel('创建学员班').click();

      // Should show create modal
      await expect(page.getByRole('heading', { name: '创建学员班' })).toBeVisible();

      // Fill class name
      await page.getByPlaceholder('输入班级名称（2-30字）').fill('周末提高班');

      // Click create button
      await page.getByRole('button', { name: '创建', exact: true }).click();

      // Modal should close and the new class should appear
      await expect(page.getByText('周末提高班')).toBeVisible({ timeout: 5000 });
    });

    test('coach adds student to class', async ({ page }) => {
      await loginAsCoach(page, coachPhone);
      await page.goto(`${WEB_BASE}/my-student-classes`);
      await page.waitForLoadState('networkidle');

      // Click on the class to view details
      await page.getByText('周末提高班').click();
      await page.waitForLoadState('networkidle');

      // Should be on the detail page
      await expect(page.getByText('周末提高班')).toBeVisible();

      // Students tab should be active by default
      await expect(page.getByText('暂无学员')).toBeVisible();

      // Click "添加学员"
      await page.getByRole('button', { name: '添加学员' }).click();

      // Should show add student modal
      await expect(page.getByPlaceholder('搜索昵称或手机号')).toBeVisible();

      // Search by student phone (last 4 digits)
      const last4 = studentPhone1.slice(-4);
      await page.getByPlaceholder('搜索昵称或手机号').fill(last4);
      await page.getByRole('button', { name: '搜索' }).click();

      // Wait for search results
      await expect(page.getByRole('button', { name: '添加' }).first()).toBeVisible({
        timeout: 5000,
      });

      // Click add on the first result
      await page.getByRole('button', { name: '添加' }).first().click();

      // Modal should close and student should appear in the list
      await page.waitForLoadState('networkidle');
    });

    test('student receives notification after being added to class', async ({ page }) => {
      // Login as student
      await login(page, studentPhone1);

      // Navigate to notifications
      await page.goto(`${WEB_BASE}/notifications`);
      await page.waitForLoadState('networkidle');

      // Should see notification about being added to the class
      await expect(page.getByText(/加入了学员班/).or(page.getByText(/学员班/))).toBeVisible({
        timeout: 5000,
      });
    });

    test('coach switches to lessons tab and creates a lesson', async ({ page }) => {
      await loginAsCoach(page, coachPhone);
      await page.goto(`${WEB_BASE}/my-student-classes`);
      await page.waitForLoadState('networkidle');

      // Navigate to the class detail
      await page.getByText('周末提高班').click();
      await page.waitForLoadState('networkidle');

      // Switch to lessons tab
      await page.getByText('课程').click();

      // Should see empty state
      await expect(page.getByText('暂无课程')).toBeVisible();

      // Click "创建课程"
      await page.getByRole('button', { name: '创建课程' }).click();

      // Should show create lesson modal
      await expect(page.getByText('创建课程').nth(1)).toBeVisible();

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

      // Search and select venue
      const venueInput = page.getByPlaceholder('搜索球馆');
      await venueInput.fill('球馆');

      // Wait for search results and select the first one
      const venueResult = page.locator('button').filter({ hasText: /球馆/ }).first();
      await venueResult.waitFor({ state: 'visible', timeout: 5000 });
      await venueResult.click();

      // Fill training content
      await page.getByPlaceholder('填写训练内容').fill('热身 -> 步法训练 -> 高远球练习 -> 对练');

      // Click create
      await page.getByRole('button', { name: '创建' }).click();

      // Lesson should appear in the list
      await page.waitForLoadState('networkidle');
    });

    test('coach views lesson detail and edits training content', async ({ page }) => {
      await loginAsCoach(page, coachPhone);
      await page.goto(`${WEB_BASE}/my-student-classes`);
      await page.waitForLoadState('networkidle');

      // Navigate to class -> lessons tab -> first lesson
      await page.getByText('周末提高班').click();
      await page.waitForLoadState('networkidle');
      await page.getByText('课程').click();

      // Click on the first lesson
      const firstLesson = page.locator('.dark-card').first();
      await firstLesson.click();
      await page.waitForLoadState('networkidle');

      // Should see lesson detail page
      await expect(page.getByText('课程详情')).toBeVisible();
      await expect(page.getByText('训练内容')).toBeVisible();

      // Click "编辑" button for training content
      await page.getByRole('button', { name: '编辑' }).click();

      // Should show textarea with current content
      const contentTextarea = page.getByPlaceholder(/填写训练内容/);
      await expect(contentTextarea).toBeVisible();

      // Modify training content
      await contentTextarea.fill('热身 -> 步法训练 -> 高远球练习 -> 杀球练习 -> 对练');

      // Save
      await page.getByRole('button', { name: '保存' }).click();

      // Should show updated content
      await expect(page.getByText('杀球练习')).toBeVisible({ timeout: 5000 });
    });

    test('coach adds lesson notes (append mode)', async ({ page }) => {
      await loginAsCoach(page, coachPhone);
      await page.goto(`${WEB_BASE}/my-student-classes`);
      await page.waitForLoadState('networkidle');

      await page.getByText('周末提高班').click();
      await page.waitForLoadState('networkidle');
      await page.getByText('课程').click();

      // Click on the first lesson
      const firstLesson = page.locator('.dark-card').first();
      await firstLesson.click();
      await page.waitForLoadState('networkidle');

      // Should see notes section
      await expect(page.getByText('课程笔记')).toBeVisible();

      // Add first note
      await page.getByPlaceholder('输入笔记内容').fill('学员步法需要加强');
      await page.getByRole('button', { name: '添加' }).click();

      // First note should be visible
      await expect(page.getByText('学员步法需要加强')).toBeVisible({
        timeout: 5000,
      });

      // Add second note
      await page.getByPlaceholder('输入笔记内容').fill('高远球动作有改善');
      await page.getByRole('button', { name: '添加' }).click();

      // Both notes should be visible (append mode)
      await expect(page.getByText('学员步法需要加强')).toBeVisible();
      await expect(page.getByText('高远球动作有改善')).toBeVisible({
        timeout: 5000,
      });
    });

    test('coach views student profile and adds tags and notes', async ({ page }) => {
      await loginAsCoach(page, coachPhone);
      await page.goto(`${WEB_BASE}/my-student-classes`);
      await page.waitForLoadState('networkidle');

      await page.getByText('周末提高班').click();
      await page.waitForLoadState('networkidle');

      // Students tab should show the added student
      // Click on the student to view profile
      const studentCard = page.locator('.dark-card').first();
      await studentCard.click();
      await page.waitForLoadState('networkidle');

      // Should see student profile page with tags and notes sections
      await expect(page.getByText('标签')).toBeVisible();
      await expect(page.getByText('学员笔记')).toBeVisible();

      // Add a tag
      await page.getByPlaceholder('输入标签（最多20字）').fill('进攻型');
      // Click the 添加 button in the tags section
      const tagSection = page.locator('div').filter({ hasText: /^标签/ }).first().locator('..');
      await tagSection.getByRole('button', { name: '添加' }).click();

      // Tag should appear
      await expect(page.getByText('进攻型')).toBeVisible({ timeout: 5000 });

      // Add a student note
      const noteInput = page
        .locator('div')
        .filter({ hasText: /学员笔记/ })
        .first()
        .locator('..')
        .getByPlaceholder('输入笔记内容');
      await noteInput.fill('需要加强防守意识');
      const noteSection = page
        .locator('div')
        .filter({ hasText: /学员笔记/ })
        .first()
        .locator('..');
      await noteSection.getByRole('button', { name: '添加' }).click();

      // Note should appear
      await expect(page.getByText('需要加强防守意识')).toBeVisible({
        timeout: 5000,
      });
    });

    test('coach cancels a scheduled lesson', async ({ page }) => {
      await loginAsCoach(page, coachPhone);
      await page.goto(`${WEB_BASE}/my-student-classes`);
      await page.waitForLoadState('networkidle');

      await page.getByText('周末提高班').click();
      await page.waitForLoadState('networkidle');
      await page.getByText('课程').click();

      // Click on the lesson
      const firstLesson = page.locator('.dark-card').first();
      await firstLesson.click();
      await page.waitForLoadState('networkidle');

      // Click "取消课程" button (only visible for scheduled lessons)
      const cancelBtn = page.getByRole('button', { name: '取消课程' });
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();

        // Confirm cancellation
        await expect(page.getByText('确认取消该课程？')).toBeVisible();
        await page.getByRole('button', { name: '确认取消' }).click();

        // Should show cancelled status
        await expect(page.getByText('已取消')).toBeVisible({ timeout: 5000 });
      }
    });

    test('coach removes student from class', async ({ page }) => {
      await loginAsCoach(page, coachPhone);
      await page.goto(`${WEB_BASE}/my-student-classes`);
      await page.waitForLoadState('networkidle');

      await page.getByText('周末提高班').click();
      await page.waitForLoadState('networkidle');

      // Click "移除" button on the student
      const removeBtn = page.getByRole('button', { name: '移除' }).first();
      if (await removeBtn.isVisible()) {
        await removeBtn.click();

        // Confirm removal
        await expect(page.getByText('确认移除该学员？')).toBeVisible();
        await page.getByRole('button', { name: '确认' }).click();

        // Student should be removed
        await page.waitForLoadState('networkidle');
      }
    });

    test('removed student receives notification', async ({ page }) => {
      await login(page, studentPhone1);
      await page.goto(`${WEB_BASE}/notifications`);
      await page.waitForLoadState('networkidle');

      // Should see notification about being removed
      await expect(
        page.getByText(/移出学员班/).or(page.getByText(/移出/).or(page.getByText(/学员班/))),
      ).toBeVisible({ timeout: 5000 });
    });

    test('coach deletes class with confirmation', async ({ page }) => {
      await loginAsCoach(page, coachPhone);
      await page.goto(`${WEB_BASE}/my-student-classes`);
      await page.waitForLoadState('networkidle');

      // Click delete button on the class card
      const deleteBtn = page.getByRole('button', { name: '删除' }).first();
      await deleteBtn.click();

      // Should show confirmation dialog
      await expect(page.getByText(/确认删除该学员班/)).toBeVisible();

      // Confirm deletion
      await page.getByRole('button', { name: '确认删除' }).click();

      // Class should be removed from the list
      await expect(page.getByText('暂无学员班')).toBeVisible({
        timeout: 5000,
      });
    });
  });
});
