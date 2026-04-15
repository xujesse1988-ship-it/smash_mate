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

  // Click send verification code and wait for API response (success or rate-limited)
  const sendCodeResponse = page.waitForResponse(
    (resp) => resp.url().includes('/api/auth/send-code') && resp.status() >= 200,
  );
  await page.getByRole('button', { name: '获取验证码' }).click();
  await sendCodeResponse;

  // Fill verification code (DEV_VERIFICATION_CODE always works regardless of send-code result)
  const codeInput = page.getByPlaceholder('6 位验证码');
  await codeInput.fill(DEV_CODE);

  // Click login and wait for login API response
  const loginResponse = page.waitForResponse(
    (resp) => resp.url().includes('/api/auth/login'),
  );
  await page.getByRole('button', { name: '登录' }).click();
  await loginResponse;

  // Wait for navigation to complete (should redirect to /activities)
  await page.waitForURL('**/activities', { timeout: 10000 });
}

/**
 * Register a new user: navigate to /login, switch to register tab,
 * fill phone, send code, enter code, submit.
 *
 * When `options.isCoach` is true, the registration goes through the
 * backend API directly (passing isCoach=true), since the UI no longer
 * exposes a coach checkbox. The resulting token is injected into
 * localStorage and the page is navigated to /activities.
 */
export async function register(
  page: Page,
  phone: string,
  options?: { isCoach?: boolean },
): Promise<void> {
  if (options?.isCoach) {
    await page.request.post('/api/auth/send-code', { data: { phone } });
    const resp = await page.request.post('/api/auth/login', {
      data: { phone, code: DEV_CODE, isCoach: true },
    });
    const body = await resp.json();
    const token: string = body.data.token;
    const userId: string = body.data.user.id;

    // Inject token into localStorage before any page script runs, then go
    // directly to /activities without visiting /login (avoids leaving the
    // /login route in a half-mounted state that would break the next test
    // in a shared context).
    await page.addInitScript(
      ({ token, userId }) => {
        localStorage.setItem('token', token);
        localStorage.setItem('userId', userId);
      },
      { token, userId },
    );
    await page.goto('/activities');
    await page.waitForURL('**/activities', { timeout: 10000 });
    return;
  }

  await page.goto('/login');

  // Switch to register tab — wait up to 20s for the React app to mount
  // (Vite dev server cold-starts can be slow and networkidle is unreliable with HMR).
  const registerTab = page.getByRole('tab', { name: '注册' });
  await registerTab.waitFor({ state: 'visible', timeout: 20000 });
  await registerTab.click();

  // Fill phone number
  const phoneInput = page.getByPlaceholder('请输入手机号');
  await phoneInput.fill(phone);

  // Click send verification code and wait for API response
  const sendCodeResponse = page.waitForResponse(
    (resp) => resp.url().includes('/api/auth/send-code') && resp.status() >= 200,
  );
  await page.getByRole('button', { name: '获取验证码' }).click();
  await sendCodeResponse;

  // Fill verification code (DEV_VERIFICATION_CODE always works regardless of send-code result)
  const codeInput = page.getByPlaceholder('6 位验证码');
  await codeInput.fill(DEV_CODE);

  // Click register and wait for login API response
  const loginResponse = page.waitForResponse(
    (resp) => resp.url().includes('/api/auth/login'),
  );
  await page.getByRole('button', { name: '注册' }).click();
  await loginResponse;

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
  // Click the date time picker to open it.
  // The DateTimePicker renders: container > label div (with exact label text) + display div (cursor: pointer)
  // We need to find the container that has a direct child with the exact label text
  const labelDiv = page.getByText(label, { exact: true });
  // The clickable display div is the next sibling of the label div
  const picker = labelDiv.locator('xpath=following-sibling::div[1]');
  await picker.click();

  // Wait for the picker dropdown to appear (the dropdown contains "选择日期" header)
  await expect(page.getByText('选择日期', { exact: true })).toBeVisible();
  // Also wait for "选择时间" to ensure the full dropdown is rendered
  await expect(page.getByText('选择时间', { exact: true })).toBeVisible();

  // Get the target date
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + options.dayOffset);
  const targetDay = targetDate.getDate();

  // Click the day in the horizontal date selector
  // Day buttons have flex-shrink: 0 and width: 56px
  const dayButtons = page.locator('div[style*="flex-shrink: 0"][style*="width: 56"]');
  const targetDayButton = dayButtons
    .filter({
      has: page.locator(`text="${targetDay}"`),
    })
    .first();
  await targetDayButton.click();

  // The hour and minute columns are scrollable divs with height: 160px and overflow-y: auto.
  // They are children of the time section which contains the "时" and "分" labels.
  // Use JavaScript evaluation to reliably click the hour and minute items.
  const hourText = String(options.hour).padStart(2, '0');
  const minuteText = String(options.minute).padStart(2, '0');

  // Verify the dropdown is still open after selecting a date
  const isTimeVisible = await page.getByText('选择时间', { exact: true }).isVisible().catch(() => false);
  if (!isTimeVisible) {
    // If the dropdown closed after clicking the day, we need to reopen it
    await picker.click();
    await expect(page.getByText('选择日期', { exact: true })).toBeVisible();
    await expect(page.getByText('选择时间', { exact: true })).toBeVisible();
  }

  // Use page.evaluate to tag the correct elements, then Playwright native click
  await page.evaluate(
    ({ hour, minute }) => {
      const allDivs = Array.from(document.querySelectorAll('div'));
      const timeHeader = allDivs.find(
        (el) =>
          el.textContent?.trim() === '选择时间' && el.children.length === 0,
      );
      if (!timeHeader?.parentElement) return;

      const timeSection = timeHeader.parentElement;
      const flexContainer = timeSection.querySelector('div[style*="display: flex"]');
      if (!flexContainer) return;

      const columns = Array.from(flexContainer.children).filter(
        (el) => (el as HTMLElement).children.length >= 2,
      );
      if (columns.length < 2) return;

      const hourScroll = columns[0].children[1] as HTMLElement;
      const minuteScroll = columns[1].children[1] as HTMLElement;

      for (const child of Array.from(hourScroll.children)) {
        if ((child as HTMLElement).textContent?.trim() === hour) {
          (child as HTMLElement).setAttribute('data-e2e-hour', 'true');
          break;
        }
      }
      for (const child of Array.from(minuteScroll.children)) {
        if ((child as HTMLElement).textContent?.trim() === minute) {
          (child as HTMLElement).setAttribute('data-e2e-minute', 'true');
          break;
        }
      }
    },
    { hour: hourText, minute: minuteText },
  );

  // Click hour using Playwright's native click
  // Use force: true to bypass actionability checks (element might be inside scrollable area)
  const hourEl = page.locator('[data-e2e-hour="true"]');
  await expect(hourEl).toBeAttached();
  await hourEl.click({ force: true });

  // Small wait for React state update
  await page.waitForTimeout(50);

  // Click minute
  const minuteEl = page.locator('[data-e2e-minute="true"]');
  await expect(minuteEl).toBeAttached();
  await minuteEl.click({ force: true });

  // Clean up
  await page.evaluate(() => {
    document.querySelectorAll('[data-e2e-hour], [data-e2e-minute]').forEach((el) => {
      el.removeAttribute('data-e2e-hour');
      el.removeAttribute('data-e2e-minute');
    });
  });

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
  const sendCodeResponse = page.waitForResponse(
    (resp) => resp.url().includes('/api/auth/send-code') && resp.status() >= 200,
  );
  await page.getByRole('button', { name: '获取验证码' }).click();
  await sendCodeResponse;
  await page.getByPlaceholder('验证码').fill(DEV_CODE);
  await page.getByRole('button', { name: '登录' }).click();

  // Admin redirects to /cities after login
  await page.waitForURL(`${ADMIN_BASE}/cities`, { timeout: 10000 });
}
