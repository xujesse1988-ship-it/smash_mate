import { type Page, expect } from '@playwright/test';

/**
 * DEV_VERIFICATION_CODE must be set to "123456" on the backend dev server
 * for E2E tests to work (see .env.example).
 */
const DEV_CODE = '123456';

/**
 * Admin phone number seeded in the E2E database.
 * This must match the ADMIN_PHONES env var used by the backend.
 */
export const ADMIN_PHONE = '13900000000';

/**
 * Admin app base URL.
 */
const ADMIN_BASE = 'http://localhost:5174';

/**
 * Complete login flow: navigate to /login, send code, enter code, submit.
 * After calling this, the page should be redirected to /activities.
 */
export async function login(page: Page, phone: string): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Fill phone number
  const phoneInput = page.getByPlaceholder('请输入手机号');
  await phoneInput.fill(phone);

  // Click send verification code
  await page.getByRole('button', { name: '获取验证码' }).click();

  // Wait for the success toast to appear (Ant Design message)
  await expect(page.getByText('验证码已发送')).toBeVisible({ timeout: 5000 });

  // Fill verification code
  const codeInput = page.getByPlaceholder('6 位验证码');
  await codeInput.fill(DEV_CODE);

  // Click login
  await page.getByRole('button', { name: '登录' }).click();

  // Wait for navigation to complete (should redirect to /activities)
  await page.waitForURL('**/activities', { timeout: 10000 });
}

/**
 * Register a new user: navigate to /login, switch to register tab,
 * fill phone, send code, enter code, submit.
 */
export async function register(
  page: Page,
  phone: string,
  options?: { isCoach?: boolean },
): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Switch to register tab
  await page.getByRole('tab', { name: '注册' }).click();

  // Fill phone number
  const phoneInput = page.getByPlaceholder('请输入手机号');
  await phoneInput.fill(phone);

  // Click send verification code
  await page.getByRole('button', { name: '获取验证码' }).click();
  await expect(page.getByText('验证码已发送')).toBeVisible({ timeout: 5000 });

  // Fill verification code
  const codeInput = page.getByPlaceholder('6 位验证码');
  await codeInput.fill(DEV_CODE);

  // Optionally check "I am a coach"
  if (options?.isCoach) {
    await page.getByText('我是教练').click();
  }

  // Click register
  await page.getByRole('button', { name: '注册' }).click();

  // Wait for navigation to complete
  await page.waitForURL('**/activities', { timeout: 10000 });
}

/**
 * Logout the current user via the /logout route.
 */
export async function logout(page: Page): Promise<void> {
  await page.goto('/logout');
  await page.waitForURL('**/login', { timeout: 5000 });
}

/**
 * Navigate to the activity creation page and fill the form.
 * Venue is selected by typing a keyword and picking the first result.
 */
export async function createActivity(
  page: Page,
  options: {
    venueKeyword: string;
    maxParticipants?: number;
    title?: string;
  },
): Promise<void> {
  // Navigate to create activity page
  await page.goto('/activities/create');
  await page.waitForLoadState('networkidle');

  // Search and select venue
  const venueInput = page.getByPlaceholder('搜索球馆');
  await venueInput.fill(options.venueKeyword);

  // Wait for search results to load, then click the first venue result
  const venueDropdown = page.locator('button').filter({ hasText: options.venueKeyword }).first();
  await venueDropdown.waitFor({ state: 'visible', timeout: 5000 });
  await venueDropdown.click();

  // Wait for the "已选:" text to appear confirming selection
  await expect(page.getByText(/已选:/)).toBeVisible();

  // Fill optional title
  if (options.title) {
    await page.getByPlaceholder('输入活动标题').fill(options.title);
  }

  // Select start time (tomorrow, 10:00)
  await selectDateTime(page, '开始时间', { dayOffset: 1, hour: 10, minute: 0 });

  // Select end time (tomorrow, 12:00)
  await selectDateTime(page, '结束时间', { dayOffset: 1, hour: 12, minute: 0 });

  // Set max participants
  if (options.maxParticipants !== undefined) {
    const maxInput = page.locator('input[type="number"][min="2"]');
    await maxInput.fill(String(options.maxParticipants));
  }

  // Submit
  await page.getByRole('button', { name: '发布' }).click();

  // Wait for navigation back to activities list or detail page
  await page.waitForURL(/\/activities/, { timeout: 10000 });
}

/**
 * Select a date and time using the custom DateTimePicker component.
 * Clicks the picker with the given label, selects a date offset from today,
 * and picks the hour and minute.
 */
export async function selectDateTime(
  page: Page,
  label: string,
  options: { dayOffset: number; hour: number; minute: number },
): Promise<void> {
  // Click the date time picker to open it
  const picker = page
    .locator('div')
    .filter({ hasText: label })
    .locator('div[style*="cursor: pointer"]')
    .first();
  await picker.click();

  // Wait for the picker dropdown to appear
  await expect(page.getByText('选择日期')).toBeVisible();

  // Get the target date
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + options.dayOffset);
  const targetDay = targetDate.getDate();

  // Click the day in the horizontal date selector
  // The day number is displayed in a div with fontSize 16 and fontWeight 600
  const dayButtons = page.locator('div[style*="width: 56"]');
  const targetDayButton = dayButtons
    .filter({
      has: page.locator(`text="${targetDay}"`),
    })
    .first();
  await targetDayButton.click();

  // Select hour - find in the hour column
  const hourText = String(options.hour).padStart(2, '0');
  const hourColumn = page
    .locator('div')
    .filter({ hasText: '时' })
    .locator('div[style*="height: 160"]')
    .first();
  await hourColumn.locator(`text="${hourText}"`).click();

  // Select minute - find in the minute column
  const minuteText = String(options.minute).padStart(2, '0');
  const minuteColumn = page
    .locator('div')
    .filter({ hasText: '分' })
    .locator('div[style*="height: 160"]')
    .first();
  await minuteColumn.locator(`text="${minuteText}"`).click();

  // Click confirm button
  await page.getByRole('button', { name: /确定/ }).click();
}

/**
 * Generate a unique phone number for tests to avoid collisions.
 * Format: 139XXXXXNNN where NNN is the provided suffix.
 */
export function testPhone(suffix: number): string {
  // Ensure the suffix is zero-padded to at least 4 digits
  const paddedSuffix = String(suffix).padStart(4, '0');
  // Use 139 + 4 digits (from timestamp modulo) + 4 digit suffix = 11 digits
  return `139${paddedSuffix}${String(Date.now()).slice(-4)}`;
}

/**
 * Generate a stable test phone number for predictable tests.
 * Format: 1390000NNNN where NNNN is the suffix.
 */
export function stablePhone(suffix: number): string {
  return `1390000${String(suffix).padStart(4, '0')}`;
}

/**
 * Login to the admin app (port 5174) using the seeded admin phone.
 * After calling this, the page should be on the admin /cities page.
 */
export async function loginAsAdmin(page: Page, phone: string = ADMIN_PHONE): Promise<void> {
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
