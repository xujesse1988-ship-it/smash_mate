import fs from "node:fs/promises";
import path from "node:path";
import { chromium, devices } from "playwright";

const BASE_URL = "http://116.62.83.91:5173";
const USER_PHONE = "13454608977";
const COACH_PHONE = "13686804800";
const VERIFY_CODE = "123456";
const CLASS_NAME = "周末提高班";
let targetStudentNickname = null;
let targetStudentId = null;

const ROOT = path.resolve("presentation2");
const RAW_DIR = path.join(ROOT, "assets", "screenshots");
const PROCESSED_DIR = path.join(ROOT, "assets", "processed");

const SCREEN = { width: 393, height: 852 };
const SYSTEM_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MODE = process.argv[2] || "all";

async function ensureDirs() {
  await fs.mkdir(RAW_DIR, { recursive: true });
  await fs.mkdir(PROCESSED_DIR, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForQuiet(page, ms = 900) {
  try {
    await page.waitForLoadState("networkidle", { timeout: 10000 });
  } catch {
    await sleep(ms);
  }
  await sleep(ms);
}

async function screenshot(page, name, options = {}) {
  await waitForQuiet(page, 600);
  await page.screenshot({
    path: path.join(RAW_DIR, name),
    fullPage: false,
    ...options,
  });
}

async function elementShot(locator, name) {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await sleep(400);
  await locator.screenshot({
    path: path.join(PROCESSED_DIR, name),
  });
}

async function createContext(browser) {
  return browser.newContext({
    ...devices["iPhone 13"],
    viewport: SCREEN,
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
  });
}

async function login(page, phone) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await waitForQuiet(page);
  await page.getByPlaceholder("请输入手机号").fill(phone);
  const sendCodeResponse = page.waitForResponse((resp) => resp.url().includes("/api/auth/send-code"));
  await page.getByRole("button", { name: "获取验证码" }).click();
  await sendCodeResponse.catch(() => null);
  await page.getByPlaceholder("6 位验证码").fill(VERIFY_CODE);
  const loginResponse = page.waitForResponse((resp) => resp.url().includes("/api/auth/login"));
  await page.getByRole("button", { name: "登录" }).click();
  await loginResponse.catch(() => null);
  await page.waitForURL(/\/(activities|my-courses)/, { timeout: 15000 });
  await waitForQuiet(page);
}

async function logout(page) {
  await page.goto(`${BASE_URL}/logout`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/login/, { timeout: 10000 }).catch(() => null);
}

async function clickFirst(locator) {
  const count = await locator.count();
  if (count > 0) {
    await locator.first().click();
    return true;
  }
  return false;
}

async function getStorageUserId(page) {
  return page.evaluate(() => localStorage.getItem("userId"));
}

async function selectDateTime(page, label, dayOffset, hour, minute) {
  const labelNode = page.getByText(label, { exact: true });
  const picker = labelNode.locator("xpath=following-sibling::div[1]");
  await picker.click();
  await page.getByText("选择日期", { exact: true }).waitFor({ timeout: 10000 });
  await page.getByText("选择时间", { exact: true }).waitFor({ timeout: 10000 });

  const target = new Date();
  target.setDate(target.getDate() + dayOffset);
  const targetDay = String(target.getDate());
  const dayButton = page
    .locator('div[style*="flex-shrink: 0"][style*="width: 56"]')
    .filter({ has: page.getByText(targetDay, { exact: true }) })
    .first();
  await dayButton.click();
  await sleep(250);

  const hourText = String(hour).padStart(2, "0");
  const minuteText = String(minute).padStart(2, "0");

  await page.evaluate(
    ({ hourValue, minuteValue }) => {
      const allDivs = Array.from(document.querySelectorAll("div"));
      const timeHeader = allDivs.find(
        (el) => el.textContent?.trim() === "选择时间" && el.children.length === 0,
      );
      if (!timeHeader?.parentElement) return;

      const timeSection = timeHeader.parentElement;
      const flexContainer = timeSection.querySelector('div[style*="display: flex"]');
      if (!flexContainer) return;

      const columns = Array.from(flexContainer.children).filter(
        (el) => el.children.length >= 2,
      );
      if (columns.length < 2) return;

      const hourScroll = columns[0].children[1];
      const minuteScroll = columns[1].children[1];

      for (const child of Array.from(hourScroll.children)) {
        if (child.textContent?.trim() === hourValue) {
          child.setAttribute("data-ppt-hour", "true");
          break;
        }
      }
      for (const child of Array.from(minuteScroll.children)) {
        if (child.textContent?.trim() === minuteValue) {
          child.setAttribute("data-ppt-minute", "true");
          break;
        }
      }
    },
    { hourValue: hourText, minuteValue: minuteText },
  );

  const hourEl = page.locator('[data-ppt-hour="true"]');
  await hourEl.waitFor({ state: "attached", timeout: 10000 });
  await hourEl.click({ force: true });
  await sleep(50);

  const minuteEl = page.locator('[data-ppt-minute="true"]');
  await minuteEl.waitFor({ state: "attached", timeout: 10000 });
  await minuteEl.click({ force: true });

  await page.evaluate(() => {
    document.querySelectorAll("[data-ppt-hour], [data-ppt-minute]").forEach((el) => {
      el.removeAttribute("data-ppt-hour");
      el.removeAttribute("data-ppt-minute");
    });
  });

  await page.getByRole("button", { name: /确定/ }).click();
  await sleep(300);
}

async function selectVenue(page, keyword = "球馆") {
  const venueInput = page.getByPlaceholder("搜索球馆").last();
  await venueInput.fill(keyword);
  const venueResult = page.locator("button").filter({ hasText: keyword }).first();
  await venueResult.waitFor({ timeout: 10000 });
  await venueResult.click();
  await sleep(500);
}

async function ensureActivityExists(page) {
  await page.goto(`${BASE_URL}/activities`, { waitUntil: "domcontentloaded" });
  await waitForQuiet(page);
  if ((await page.getByText("暂无活动").count()) === 0) {
    return;
  }

  await page.getByRole("button", { name: "发起约球" }).click();
  await waitForQuiet(page);
  await selectVenue(page, "球馆");
  await page.getByPlaceholder("输入活动标题").fill(`PPT演示约球 ${new Date().getMonth() + 1}/${new Date().getDate()}`);
  await selectDateTime(page, "开始时间", 1, 19, 0);
  await selectDateTime(page, "结束时间", 1, 21, 0);
  const maxInput = page.locator('input[type="number"][min="2"]').first();
  if ((await maxInput.count()) > 0) {
    await maxInput.fill("8");
  }
  await page.getByRole("button", { name: "发布" }).click();
  await page.waitForURL(/\/activities/, { timeout: 15000 }).catch(() => null);
  await waitForQuiet(page);
}

async function captureUserFlow(browser) {
  console.log("user: login");
  const context = await createContext(browser);
  const page = await context.newPage();
  await login(page, USER_PHONE);

  console.log("user: activities");
  await ensureActivityExists(page);
  await page.goto(`${BASE_URL}/activities`, { waitUntil: "domcontentloaded" });
  await waitForQuiet(page);
  await screenshot(page, "user-activities.png");
  await elementShot(page.locator("body"), "user-activities-viewport.png");

  const activityOpened = await clickFirst(page.locator(".dark-card"));
  if (activityOpened) {
    await waitForQuiet(page);
    await screenshot(page, "user-activity-detail.png");
    await elementShot(page.locator("body"), "user-activity-detail-viewport.png");
  }

  console.log("user: coaches");
  await page.goto(`${BASE_URL}/coaches`, { waitUntil: "domcontentloaded" });
  await waitForQuiet(page);
  await screenshot(page, "user-coaches.png");
  await elementShot(page.locator("body"), "user-coaches-viewport.png");

  const coachCard = page.locator('[data-testid^="coach-card-"]').first();
  if ((await coachCard.count()) > 0) {
    await coachCard.click();
    await waitForQuiet(page);
    await screenshot(page, "user-coach-profile.png");
    await elementShot(page.locator("body"), "user-coach-profile-viewport.png");
  }

  console.log("user: profile");
  const userId = await getStorageUserId(page);
  if (userId) {
    await page.goto(`${BASE_URL}/users/${userId}`, { waitUntil: "domcontentloaded" });
    await waitForQuiet(page);
    await screenshot(page, "user-profile.png");
    const cardSection = page.locator("section").first();
    if ((await cardSection.count()) > 0) {
      await elementShot(cardSection, "user-profile-card.png");
    }

    await page.goto(`${BASE_URL}/users/${userId}/match-records`, { waitUntil: "domcontentloaded" });
    await waitForQuiet(page);
    await screenshot(page, "user-match-records.png");
    await elementShot(page.locator("body"), "user-match-records-viewport.png");
  }

  await context.close();
  console.log("user: done");
}

async function ensureCoachMode(page) {
  await page.goto(`${BASE_URL}/settings`, { waitUntil: "domcontentloaded" });
  await waitForQuiet(page);
  const switchInput = page.locator('button[role="switch"], input[type="checkbox"]').first();
  if ((await switchInput.count()) > 0) {
    const ariaChecked = await switchInput.getAttribute("aria-checked");
    const checked = ariaChecked === "true";
    if (!checked) {
      await switchInput.click();
      await sleep(600);
    }
  }
}

async function ensureClassExists(page) {
  await page.goto(`${BASE_URL}/my-courses`, { waitUntil: "domcontentloaded" });
  await waitForQuiet(page);
  await page.getByRole("button", { name: "学员班", exact: true }).click();
  await waitForQuiet(page);

  if ((await page.getByText(CLASS_NAME, { exact: true }).count()) > 0) {
    return;
  }
}

async function openClassDetail(page) {
  await page.goto(`${BASE_URL}/my-courses`, { waitUntil: "domcontentloaded" });
  await waitForQuiet(page);
  await page.getByRole("button", { name: "学员班", exact: true }).click();
  await waitForQuiet(page);
  const preferred = page.getByText(CLASS_NAME, { exact: true });
  if ((await preferred.count()) > 0) {
    await preferred.first().click();
  } else {
    await page.locator(".dark-card").first().click();
  }
  await waitForQuiet(page);
}

async function viewClassStudentModal(page) {
  await openClassDetail(page);
  await page.getByRole("button", { name: "添加学员" }).click();
  await waitForQuiet(page);
  return page.locator("h3", { hasText: "添加学员" }).locator("xpath=ancestor::div[2]");
}

async function viewClassLessonModal(page) {
  await openClassDetail(page);
  await page.getByRole("button", { name: "课程", exact: true }).click();
  await waitForQuiet(page);
  await page.getByRole("button", { name: "创建课程" }).click();
  await waitForQuiet(page);
  await selectDateTime(page, "开始时间", 2, 14, 0);
  await selectDateTime(page, "结束时间", 2, 16, 0);
  await selectVenue(page, "球馆");
  await page.getByPlaceholder("填写训练内容").fill("热身、步法、多球与对抗演练");
  await screenshot(page, "coach-class-create-lesson-modal.png");
  const modal = page.locator("h3", { hasText: "创建课程" }).locator("xpath=ancestor::div[2]");
  if ((await modal.count()) > 0) {
    await elementShot(modal.first(), "coach-class-create-lesson-modal-panel.png");
  }
  await page.getByRole("button", { name: "取消" }).click().catch(() => null);
  await waitForQuiet(page);
}

async function ensureStudentInCoachStudents(page) {
  await page.goto(`${BASE_URL}/my-students`, { waitUntil: "domcontentloaded" });
  await waitForQuiet(page);
  await page.getByTestId("coach-student-add-fab").click();
  await waitForQuiet(page);
  await page.getByTestId("coach-student-phone-input").fill(USER_PHONE);
  await page.getByTestId("coach-student-phone-search-btn").click();
  await waitForQuiet(page, 1200);
  const lookup = await page.evaluate(async (phone) => {
    const token = localStorage.getItem("token");
    const response = await fetch("/api/coach-students/search-by-phone", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
      },
      body: JSON.stringify({ phone }),
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload?.data ?? null;
  }, USER_PHONE).catch(() => null);
  if (lookup?.userId) {
    targetStudentId = lookup.userId;
  }
  if (lookup?.nickname) {
    targetStudentNickname = lookup.nickname;
  }
  const result = page.getByTestId("coach-student-search-result");
  if ((await result.count()) > 0) {
    const nameNode = result.locator("span").first();
    const maybeName = (await nameNode.textContent())?.trim();
    if (maybeName) {
      targetStudentNickname = maybeName;
    }
  }
  const addBtn = page.getByTestId("coach-student-add-btn");
  if ((await addBtn.count()) > 0) {
    await addBtn.click();
    await sleep(1200);
  }
}

async function createPrivateLessonForStudent(page) {
  await page.goto(`${BASE_URL}/my-students`, { waitUntil: "domcontentloaded" });
  await waitForQuiet(page);
  const listSearch = page.getByTestId("coach-student-search-input");
  if ((await listSearch.count()) > 0) {
    await listSearch.fill(targetStudentNickname || "");
    await sleep(500);
  }
  let studentCard = page.locator('[data-testid^="coach-student-"]').first();
  if (targetStudentNickname) {
    const targetCard = page.locator('[data-testid^="coach-student-"]').filter({
      hasText: targetStudentNickname,
    });
    if ((await targetCard.count()) > 0) {
      studentCard = targetCard.first();
    }
  }
  const testId = await studentCard.getAttribute("data-testid");
  const studentId = targetStudentId || testId?.replace("coach-student-", "");
  if (studentId) {
    await page.goto(`${BASE_URL}/my-students/${studentId}`, { waitUntil: "domcontentloaded" });
  } else {
    await studentCard.click({ force: true });
  }
  await waitForQuiet(page);
  await screenshot(page, "coach-student-detail.png");
  await elementShot(page.locator("body"), "coach-student-detail-viewport.png");
  await page.getByTestId("coach-student-create-lesson-btn").click();
  await waitForQuiet(page);
  await selectDateTime(page, "开始时间", 3, 19, 0);
  await selectDateTime(page, "结束时间", 3, 20, 0);
  await selectVenue(page, "球馆");
  await page.getByPlaceholder("输入训练内容").fill("后场步法、吊球衔接与多拍节奏");
  await screenshot(page, "coach-private-lesson-modal.png");
  const modal = page.locator("h3", { hasText: "给 TA 排课" }).locator("xpath=ancestor::div[2]");
  if ((await modal.count()) > 0) {
    await elementShot(modal.first(), "coach-private-lesson-modal-panel.png");
  }
  await page.getByTestId("coach-student-submit-lesson-btn").click().catch(() => null);
  await sleep(1500);
  await screenshot(page, "coach-student-detail-upcoming.png");
  const upcomingCard = page.getByTestId("coach-student-upcoming-lesson");
  if ((await upcomingCard.count()) > 0) {
    await elementShot(upcomingCard, "coach-student-upcoming-card.png");
  }
}

async function captureCoachFlow(browser) {
  console.log("coach: login");
  const context = await createContext(browser);
  const page = await context.newPage();
  await login(page, COACH_PHONE);

  console.log("coach: ensure mode");
  await ensureCoachMode(page);
  console.log("coach: settings");
  await page.goto(`${BASE_URL}/settings`, { waitUntil: "domcontentloaded" });
  await waitForQuiet(page);
  await screenshot(page, "coach-settings.png");
  await elementShot(page.locator("body"), "coach-settings-viewport.png");

  console.log("coach: workspace");
  await page.goto(`${BASE_URL}/my-courses`, { waitUntil: "domcontentloaded" });
  await waitForQuiet(page);
  await screenshot(page, "coach-my-courses.png");
  await elementShot(page.locator("body"), "coach-my-courses-viewport.png");

  console.log("coach: class exists");
  await ensureClassExists(page);
  console.log("coach: class tab");
  await page.goto(`${BASE_URL}/my-courses`, { waitUntil: "domcontentloaded" });
  await waitForQuiet(page);
  await page.getByRole("button", { name: "学员班", exact: true }).click();
  await waitForQuiet(page);
  await screenshot(page, "coach-student-classes.png");
  await elementShot(page.locator("body"), "coach-student-classes-viewport.png");

  console.log("coach: create class modal");
  await page.getByLabel("创建学员班").click();
  await waitForQuiet(page);
  await page.getByPlaceholder("输入班级名称（2-30字）").fill(CLASS_NAME);
  await screenshot(page, "coach-create-class-modal.png");
  const classModal = page.locator("h3", { hasText: "创建学员班" }).locator("xpath=ancestor::div[2]");
  if ((await classModal.count()) > 0) {
    await elementShot(classModal.first(), "coach-create-class-modal-panel.png");
  }
  await page.getByRole("button", { name: "取消" }).click().catch(() => null);
  await waitForQuiet(page);

  console.log("coach: class students");
  await openClassDetail(page);
  await screenshot(page, "coach-class-detail-students.png");
  await elementShot(page.locator("body"), "coach-class-detail-students-viewport.png");

  console.log("coach: add student modal");
  const addStudentModal = await viewClassStudentModal(page);
  await page.getByPlaceholder("搜索昵称或手机号").fill(USER_PHONE.slice(-4)).catch(() => null);
  await page.getByRole("button", { name: "搜索" }).click().catch(() => null);
  await waitForQuiet(page, 1200);
  await screenshot(page, "coach-add-student-modal.png");
  if ((await addStudentModal.count()) > 0) {
    await elementShot(addStudentModal.first(), "coach-add-student-modal-panel.png");
  }
  await page.getByRole("button", { name: "关闭" }).click().catch(() => null);
  await waitForQuiet(page);

  console.log("coach: class lesson");
  await viewClassLessonModal(page);
  await openClassDetail(page);
  await page.getByRole("button", { name: "课程", exact: true }).click();
  await waitForQuiet(page);
  await screenshot(page, "coach-class-detail-lessons.png");
  await elementShot(page.locator("body"), "coach-class-detail-lessons-viewport.png");

  console.log("coach: my students");
  await ensureStudentInCoachStudents(page);
  await page.goto(`${BASE_URL}/my-students`, { waitUntil: "domcontentloaded" });
  await waitForQuiet(page);
  await screenshot(page, "coach-my-students.png");
  await elementShot(page.locator("body"), "coach-my-students-viewport.png");

  console.log("coach: private lesson");
  await createPrivateLessonForStudent(page);
  await context.close();
  console.log("coach: done");
}

async function writeManifest() {
  const files = {
    raw: (await fs.readdir(RAW_DIR)).sort(),
    processed: (await fs.readdir(PROCESSED_DIR)).sort(),
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
  };
  await fs.writeFile(path.join(ROOT, "assets", "manifest.json"), JSON.stringify(files, null, 2));
}

async function main() {
  await ensureDirs();
  const browser = await chromium.launch({
    headless: true,
    executablePath: SYSTEM_CHROME,
  });
  try {
    if (MODE === "all" || MODE === "user") {
      await captureUserFlow(browser);
    }
    if (MODE === "all" || MODE === "coach") {
      await captureCoachFlow(browser);
    }
    if (MODE === "private") {
      const context = await createContext(browser);
      const page = await context.newPage();
      console.log("private: login");
      await login(page, COACH_PHONE);
      console.log("private: ensure mode");
      await ensureCoachMode(page);
      console.log("private: my students");
      await ensureStudentInCoachStudents(page);
      console.log("private: capture");
      await createPrivateLessonForStudent(page);
      await context.close();
      console.log("private: done");
    }
    await writeManifest();
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
