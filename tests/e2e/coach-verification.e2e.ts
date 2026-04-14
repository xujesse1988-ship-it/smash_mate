import { test, expect, type Page } from '@playwright/test';
import { login, register, stablePhone } from './helpers';

/**
 * E2E tests for coach verification flow (Issue #97).
 *
 * Covers:
 * - User submits coach application (upload certificates + description)
 * - Shows "审核中" status and prevents duplicate submission
 * - Admin reviews application (approve / reject)
 * - Rejected user sees reason and can resubmit
 *
 * Prerequisites:
 * - Backend dev server running with DEV_VERIFICATION_CODE="123456"
 * - Frontend SPA on http://localhost:5173
 * - Admin app on http://localhost:5174
 * - PostgreSQL dev database running
 * - Admin phone 13800000001 is in ADMIN_PHONES env var
 */

const WEB_BASE = 'http://localhost:5173';
const ADMIN_BASE = 'http://localhost:5174';
const DEV_CODE = '123456';

// ---- Admin helpers (admin app on port 5174) ----

async function adminLogin(page: Page, phone: string): Promise<void> {
  await page.goto(`${ADMIN_BASE}/login`);
  await page.waitForLoadState('networkidle');

  await page.getByPlaceholder('手机号').fill(phone);
  await page.getByRole('button', { name: '获取验证码' }).click();
  await expect(page.getByText('验证码已发送')).toBeVisible({ timeout: 5000 });
  await page.getByPlaceholder('验证码').fill(DEV_CODE);
  await page.getByRole('button', { name: '登录' }).click();
  // Admin redirects to /cities after login
  await page.waitForURL(`${ADMIN_BASE}/cities`, { timeout: 10000 });
}

// ---- Test fixtures: create a small PNG via data URL for certificate upload ----

/**
 * Create a tiny valid PNG file buffer for test uploads.
 * This is a 1x1 pixel red PNG (67 bytes).
 */
function createTestPngBuffer(): Buffer {
  // Minimal valid PNG: 1x1 red pixel
  const base64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
  return Buffer.from(base64, 'base64');
}

// ---- Tests ----

test.describe('Coach Verification Flow', () => {
  // Phone numbers in the assigned range
  const applicantPhone = stablePhone(3001);
  const adminPhone = '13800000001'; // configured in .env ADMIN_PHONES

  test.describe.serial('Submit application and view pending status', () => {
    test('user can navigate to coach application page from settings', async ({ page }) => {
      // Register a new user
      await register(page, applicantPhone);
      await expect(page).toHaveURL(/\/activities/);

      // Navigate to settings
      await page.goto(`${WEB_BASE}/settings`);
      await page.waitForLoadState('networkidle');

      // Click "申请成为教练" link
      const applyLink = page.getByText('申请成为教练');
      if (await applyLink.isVisible()) {
        await applyLink.click();
        await expect(page).toHaveURL(/\/coach-apply/);
      } else {
        // Directly navigate
        await page.goto(`${WEB_BASE}/coach-apply`);
      }

      // Should see the application form
      await expect(page.getByText('申请成为教练')).toBeVisible();
      await expect(page.getByText('上传证书/奖状')).toBeVisible();
    });

    test('user can upload certificate and submit application', async ({ page }) => {
      await login(page, applicantPhone);
      await page.goto(`${WEB_BASE}/coach-apply`);
      await page.waitForLoadState('networkidle');

      // Should see the upload section
      await expect(page.getByText('上传证书/奖状')).toBeVisible();

      // Upload a test certificate image via the hidden file input
      const fileInput = page.locator('input[type="file"]');
      const pngBuffer = createTestPngBuffer();
      await fileInput.setInputFiles({
        name: 'test-certificate.png',
        mimeType: 'image/png',
        buffer: pngBuffer,
      });

      // Wait for upload to complete - certificate thumbnail should appear
      await expect(page.locator('img[alt="证书 1"]')).toBeVisible({
        timeout: 10000,
      });

      // Fill description
      const descriptionInput = page.getByPlaceholder(/简要描述你的教练资历/);
      await descriptionInput.fill('拥有5年羽毛球教学经验，省级比赛获奖');

      // Submit the application
      await page.getByRole('button', { name: '提交申请' }).click();

      // Should see success message
      await expect(page.getByText('申请已提交')).toBeVisible({
        timeout: 5000,
      });
    });

    test('pending application shows 审核中 status', async ({ page }) => {
      await login(page, applicantPhone);
      await page.goto(`${WEB_BASE}/coach-apply`);
      await page.waitForLoadState('networkidle');

      // Should show pending status
      await expect(page.getByText('审核中')).toBeVisible({ timeout: 5000 });

      // Should show submitted certificate
      await expect(page.getByText('提交的证书')).toBeVisible();

      // Should NOT show the submit form
      await expect(page.getByRole('button', { name: '提交申请' })).not.toBeVisible();
    });
  });

  test.describe.serial('Admin review - approve flow', () => {
    const approveApplicantPhone = stablePhone(3002);

    test('setup: submit application for approval', async ({ page }) => {
      await register(page, approveApplicantPhone);

      await page.goto(`${WEB_BASE}/coach-apply`);
      await page.waitForLoadState('networkidle');

      // Upload certificate
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'cert.png',
        mimeType: 'image/png',
        buffer: createTestPngBuffer(),
      });
      await expect(page.locator('img[alt="证书 1"]')).toBeVisible({
        timeout: 10000,
      });

      // Submit
      await page.getByRole('button', { name: '提交申请' }).click();
      await expect(page.getByText('申请已提交')).toBeVisible({
        timeout: 5000,
      });
    });

    test('admin can see pending application in review list', async ({ page }) => {
      // Login as admin on the admin app
      await adminLogin(page, adminPhone);

      // Navigate to coach review page
      await page.goto(`${ADMIN_BASE}/coach-review`);
      await page.waitForLoadState('networkidle');

      // Should see the review page title
      await expect(page.getByText('教练审核')).toBeVisible();

      // Click "待审核" tab to filter
      await page.getByText('待审核').click();

      // Should see at least one pending application in the table
      await expect(page.locator('table tbody tr').first()).toBeVisible({
        timeout: 5000,
      });
    });

    test('admin approves application', async ({ page }) => {
      await adminLogin(page, adminPhone);
      await page.goto(`${ADMIN_BASE}/coach-review`);
      await page.waitForLoadState('networkidle');

      // Click "待审核" tab
      await page.getByText('待审核').click();
      await page.waitForLoadState('networkidle');

      // Click on the first pending application row to view details
      const firstRow = page.locator('table tbody tr').first();
      await expect(firstRow).toBeVisible({ timeout: 5000 });
      await firstRow.click();

      // Should navigate to detail page
      await expect(page.getByText('审核详情')).toBeVisible({ timeout: 5000 });

      // Should see certificate images
      await expect(page.getByText(/上传的证书/)).toBeVisible();

      // Click approve button
      await page.getByRole('button', { name: '通过' }).click();

      // Should see success message
      await expect(page.getByText('已通过审核')).toBeVisible({
        timeout: 5000,
      });
    });

    test('approved user sees 已通过 status on coach-apply page', async ({ page }) => {
      await login(page, approveApplicantPhone);
      await page.goto(`${WEB_BASE}/coach-apply`);
      await page.waitForLoadState('networkidle');

      // Should show approved status
      await expect(page.getByText('已通过')).toBeVisible({ timeout: 5000 });

      // Should see the "管理教练资料" button
      await expect(page.getByRole('button', { name: '管理教练资料' })).toBeVisible();
    });
  });

  test.describe.serial('Admin review - reject and resubmit flow', () => {
    const rejectApplicantPhone = stablePhone(3003);

    test('setup: submit application for rejection', async ({ page }) => {
      await register(page, rejectApplicantPhone);

      await page.goto(`${WEB_BASE}/coach-apply`);
      await page.waitForLoadState('networkidle');

      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'cert.png',
        mimeType: 'image/png',
        buffer: createTestPngBuffer(),
      });
      await expect(page.locator('img[alt="证书 1"]')).toBeVisible({
        timeout: 10000,
      });

      await descriptionFill(page, '测试申请将被拒绝');
      await page.getByRole('button', { name: '提交申请' }).click();
      await expect(page.getByText('申请已提交')).toBeVisible({
        timeout: 5000,
      });
    });

    test('admin rejects application with reason', async ({ page }) => {
      await adminLogin(page, adminPhone);
      await page.goto(`${ADMIN_BASE}/coach-review`);
      await page.waitForLoadState('networkidle');

      // Filter by pending
      await page.getByText('待审核').click();
      await page.waitForLoadState('networkidle');

      // Click on the first pending row
      const firstRow = page.locator('table tbody tr').first();
      await expect(firstRow).toBeVisible({ timeout: 5000 });
      await firstRow.click();

      await expect(page.getByText('审核详情')).toBeVisible({ timeout: 5000 });

      // Click reject button
      await page.getByRole('button', { name: '拒绝' }).click();

      // Should show reject modal
      await expect(page.getByText('拒绝申请')).toBeVisible();

      // Fill reject reason (must be at least 5 characters)
      await page.getByPlaceholder('请填写拒绝原因').fill('证书不清晰，请重新上传更清晰的照片');

      // Confirm rejection
      await page.getByRole('button', { name: '确定拒绝' }).click();

      // Should see success message
      await expect(page.getByText('已拒绝申请')).toBeVisible({
        timeout: 5000,
      });
    });

    test('rejected user sees rejection reason', async ({ page }) => {
      await login(page, rejectApplicantPhone);
      await page.goto(`${WEB_BASE}/coach-apply`);
      await page.waitForLoadState('networkidle');

      // Should show rejection reason
      await expect(page.getByText('拒绝原因')).toBeVisible({ timeout: 5000 });
      await expect(page.getByText('证书不清晰，请重新上传更清晰的照片')).toBeVisible();

      // Should show resubmit button
      await expect(page.getByRole('button', { name: '重新提交申请' })).toBeVisible();
    });

    test('rejected user can resubmit application', async ({ page }) => {
      await login(page, rejectApplicantPhone);
      await page.goto(`${WEB_BASE}/coach-apply`);
      await page.waitForLoadState('networkidle');

      // Should be on the form page with "重新提交申请" button
      await expect(page.getByRole('button', { name: '重新提交申请' })).toBeVisible({
        timeout: 5000,
      });

      // Upload a new certificate
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'cert-v2.png',
        mimeType: 'image/png',
        buffer: createTestPngBuffer(),
      });
      await expect(page.locator('img[alt="证书 1"]')).toBeVisible({
        timeout: 10000,
      });

      // Fill updated description
      await descriptionFill(page, '重新提交，已更新证书照片');

      // Click resubmit
      await page.getByRole('button', { name: '重新提交申请' }).click();

      // Should see success message
      await expect(page.getByText('申请已提交')).toBeVisible({
        timeout: 5000,
      });
    });
  });
});

// ---- Helper ----

async function descriptionFill(page: Page, text: string) {
  const descriptionInput = page.getByPlaceholder(/简要描述你的教练资历/);
  await descriptionInput.fill(text);
}
