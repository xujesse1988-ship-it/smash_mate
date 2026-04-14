import { test, expect } from '@playwright/test';
import { login, register, logout } from './helpers';

/**
 * E2E tests for profile and settings flows (Issue #95).
 *
 * Phone numbers used: 13900000014 (main user), 13900000015 (other user).
 */

const MAIN_USER_PHONE = '13900000014';
const OTHER_USER_PHONE = '13900000015';

test.describe('Profile and settings', () => {
  test.describe.configure({ mode: 'serial' });

  let _mainUserId: string;
  let otherUserId: string;

  test('register main user and other user', async ({ page }) => {
    await register(page, MAIN_USER_PHONE);
    await expect(page).toHaveURL(/\/activities/);
    await logout(page);

    await register(page, OTHER_USER_PHONE);
    await expect(page).toHaveURL(/\/activities/);
    await logout(page);
  });

  test('view own profile page', async ({ page }) => {
    await login(page, MAIN_USER_PHONE);

    // Navigate to "我的" tab
    const profileTab = page.getByText('我的').last();
    await profileTab.click();
    await page.waitForURL(/\/users\//, { timeout: 5000 });

    // Store user ID
    _mainUserId = page.url().split('/users/')[1];

    // Should see user info section with nickname
    // Default nickname for newly registered users should be visible
    await expect(page.locator('body')).toContainText(MAIN_USER_PHONE.slice(-4));

    // Should see match stats (总场次, 胜场, 胜率)
    await expect(page.getByText('总场次')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('胜场')).toBeVisible();
    await expect(page.getByText('胜率')).toBeVisible();

    // Should see quick links for own profile
    await expect(page.getByText('我的活动')).toBeVisible();
    await expect(page.getByText('战绩记录')).toBeVisible();
    await expect(page.getByText('个人资料')).toBeVisible();
    await expect(page.getByText('设置')).toBeVisible();
  });

  test('edit profile - change nickname and bio', async ({ page }) => {
    await login(page, MAIN_USER_PHONE);

    // Navigate to profile edit
    await page.goto('/profile/edit');
    await page.waitForLoadState('networkidle');

    // Wait for form to be loaded
    await expect(page.getByText('编辑资料')).toBeVisible({ timeout: 5000 });

    // Clear and fill nickname
    // Find the nickname input by label proximity
    const formInputs = page.locator('div:has(> label:has-text("昵称")) input');
    if ((await formInputs.count()) > 0) {
      await formInputs.first().fill('球友小明E2E');
    } else {
      // Try another selector - the profile form has nickname as the first input field
      const allInputs = page.locator('input[type="text"], input:not([type])');
      for (let i = 0; i < (await allInputs.count()); i++) {
        const input = allInputs.nth(i);
        const value = await input.inputValue();
        // Find the input that currently has a phone-like value or default nickname
        if (value && !value.includes('@') && !value.startsWith('http')) {
          await input.fill('球友小明E2E');
          break;
        }
      }
    }

    // Fill bio
    const bioTextarea = page.locator('textarea').first();
    if (await bioTextarea.isVisible()) {
      await bioTextarea.fill('喜欢羽毛球E2E测试用户');
    }

    // Click save
    await page.getByRole('button', { name: '保存' }).click();

    // Should see success message
    await expect(page.getByText('保存成功')).toBeVisible({ timeout: 5000 });
  });

  test('verify profile edit persisted', async ({ page }) => {
    await login(page, MAIN_USER_PHONE);

    // Navigate to profile edit page
    await page.goto('/profile/edit');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('编辑资料')).toBeVisible({ timeout: 5000 });

    // The nickname should be the updated value
    const nicknameInputs = page.locator('input:not([type="file"])');
    let found = false;
    for (let i = 0; i < (await nicknameInputs.count()); i++) {
      const val = await nicknameInputs.nth(i).inputValue();
      if (val === '球友小明E2E') {
        found = true;
        break;
      }
    }
    expect(found).toBeTruthy();

    // The bio should be the updated value
    const bioTextarea = page.locator('textarea').first();
    if (await bioTextarea.isVisible()) {
      const bioVal = await bioTextarea.inputValue();
      expect(bioVal).toBe('喜欢羽毛球E2E测试用户');
    }
  });

  test('avatar upload button is visible', async ({ page }) => {
    await login(page, MAIN_USER_PHONE);

    await page.goto('/profile/edit');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('编辑资料')).toBeVisible({ timeout: 5000 });

    // The avatar upload button should be present (labeled "添加头像" or "修改头像")
    const avatarButton = page.getByRole('button', { name: /头像/ });
    await expect(avatarButton).toBeVisible();

    // The hidden file input should exist
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toHaveCount(1);
  });

  test('view another user profile', async ({ page }) => {
    await login(page, OTHER_USER_PHONE);

    // Navigate to profile to get the other user's ID
    const profileTab = page.getByText('我的').last();
    await profileTab.click();
    await page.waitForURL(/\/users\//, { timeout: 5000 });
    otherUserId = page.url().split('/users/')[1];
    await logout(page);

    // Login as main user
    await login(page, MAIN_USER_PHONE);

    // Navigate to other user's profile
    await page.goto(`/users/${otherUserId}`);
    await page.waitForLoadState('networkidle');

    // Should see the other user's profile (no quick links, but with back button)
    // Should NOT see "我的活动", "设置" etc. (those are own-profile quick links)
    await expect(page.getByText('设置')).not.toBeVisible();

    // Should see match stats
    await expect(page.getByText('总场次')).toBeVisible({ timeout: 5000 });
  });

  test('settings page navigation', async ({ page }) => {
    await login(page, MAIN_USER_PHONE);

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Should see settings title
    await expect(page.getByText('设置')).toBeVisible({ timeout: 5000 });

    // Should see settings items
    await expect(page.getByText(/教练/)).toBeVisible();
    await expect(page.getByText('修改手机号')).toBeVisible();
    await expect(page.getByText('关于我们')).toBeVisible();

    // Should see logout button
    const logoutButton = page.getByText('退出登录');
    await expect(logoutButton).toBeVisible();
  });

  test('settings page shows about dialog', async ({ page }) => {
    await login(page, MAIN_USER_PHONE);

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Click "关于我们"
    await page.getByText('关于我们').click();

    // Should show about dialog
    await expect(page.getByText('羽约 SmashMate')).toBeVisible();
    await expect(page.getByText('版本 v1.0.0')).toBeVisible();

    // Close dialog
    await page.getByRole('button', { name: '关闭' }).click();
    await expect(page.getByText('版本 v1.0.0')).not.toBeVisible();
  });

  test('settings page logout flow', async ({ page }) => {
    await login(page, MAIN_USER_PHONE);

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Click logout
    await page.getByText('退出登录').click();

    // Should show confirmation dialog
    await expect(page.getByText('确定退出登录？')).toBeVisible();

    // Confirm logout
    // Find the confirm button in the dialog
    const confirmButton = page.locator('button').filter({ hasText: '确定' });
    await confirmButton.click();

    // Should redirect to login page
    await page.waitForURL(/\/login/, { timeout: 5000 });
  });
});
