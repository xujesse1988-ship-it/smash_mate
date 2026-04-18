import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const W = 1280;
const H = 720;

const ROOT = path.resolve("presentation2");
const SCREENSHOT_DIR = path.join(ROOT, "assets", "screenshots");
const PROCESSED_DIR = path.join(ROOT, "assets", "processed");
const TMP_DIR = path.join(ROOT, "tmp");
const PREVIEW_DIR = path.join(TMP_DIR, "previews");
const OUTPUT = path.join(ROOT, "SmashMate_产品介绍与用户教练操作指引.pptx");

const COLORS = {
  bg: "#071612",
  panel: "#0F241E",
  panel2: "#133228",
  soft: "#1B4333",
  line: "#2D5E4B",
  green: "#39D98A",
  green2: "#9BFFCE",
  text: "#F4FFF9",
  muted: "#B6D4C7",
  ink: "#163427",
  white: "#FFFFFF",
  darkText: "#0C2218",
  userAccent: "#61D8A5",
  coachAccent: "#FFD166",
  warm: "#F6F0E2",
};

async function ensureDirs() {
  await fs.mkdir(PREVIEW_DIR, { recursive: true });
}

async function readImageBlob(filePath) {
  const bytes = await fs.readFile(filePath);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function imageConfig(fileName, processed = false) {
  const filePath = path.join(processed ? PROCESSED_DIR : SCREENSHOT_DIR, fileName);
  const blob = await readImageBlob(filePath);
  return { blob, path: filePath };
}

function rect(slide, left, top, width, height, fill, line = fill, radius = "roundRect") {
  return slide.shapes.add({
    geometry: radius,
    position: { left, top, width, height },
    fill,
    line: { fill: line, width: 0 },
  });
}

function plainRect(slide, left, top, width, height, fill, line = fill) {
  return slide.shapes.add({
    geometry: "rect",
    position: { left, top, width, height },
    fill,
    line: { fill: line, width: 0 },
  });
}

function circle(slide, left, top, width, height, fill, opacityHex = "") {
  return slide.shapes.add({
    geometry: "ellipse",
    position: { left, top, width, height },
    fill: `${fill}${opacityHex}`,
    line: { fill: `${fill}${opacityHex}`, width: 0 },
  });
}

function addText(slide, text, left, top, width, height, options = {}) {
  const box = slide.shapes.add({
    geometry: "rect",
    position: { left, top, width, height },
    fill: "#00000000",
    line: { fill: "#00000000", width: 0 },
  });
  box.text = text;
  box.text.fontSize = options.fontSize ?? 18;
  box.text.typeface = options.typeface ?? "Aptos";
  box.text.color = options.color ?? COLORS.text;
  box.text.bold = options.bold ?? false;
  box.text.alignment = options.align ?? "left";
  box.text.verticalAlignment = options.valign ?? "top";
  box.text.insets = options.insets ?? { left: 0, right: 0, top: 0, bottom: 0 };
  return box;
}

function addThemeBackground(slide, accent = COLORS.green) {
  slide.background.fill = COLORS.bg;
  circle(slide, -80, -130, 430, 430, accent, "1F");
  circle(slide, 980, -90, 300, 300, COLORS.coachAccent, "16");
  circle(slide, 1050, 540, 280, 280, COLORS.userAccent, "12");
  plainRect(slide, 54, 50, 1172, 620, "#0B1D17E6");
  plainRect(slide, 54, 50, 1172, 2, COLORS.line);
  plainRect(slide, 54, 668, 1172, 2, COLORS.line);
}

function addHeader(slide, section, title, number, accent = COLORS.green) {
  addText(slide, section, 76, 72, 220, 22, {
    fontSize: 12,
    typeface: "Aptos",
    color: accent,
    bold: true,
  });
  addText(slide, title, 76, 98, 760, 66, {
    fontSize: 31,
    typeface: "Aptos Display",
    color: COLORS.text,
    bold: true,
  });
  addText(slide, `${String(number).padStart(2, "0")}`, 1134, 74, 72, 34, {
    fontSize: 22,
    typeface: "Aptos Display",
    color: accent,
    bold: true,
    align: "right",
  });
}

function addBody(slide, text, left, top, width, height, color = COLORS.muted, fontSize = 18) {
  addText(slide, text, left, top, width, height, {
    fontSize,
    color,
    typeface: "Aptos",
  });
}

function addPanel(slide, left, top, width, height, fill = COLORS.panel, line = COLORS.line) {
  rect(slide, left, top, width, height, fill, line);
}

function addMiniChip(slide, text, left, top, fill, color = COLORS.darkText) {
  rect(slide, left, top, 128, 30, fill, fill);
  addText(slide, text, left + 16, top + 7, 96, 18, {
    fontSize: 12,
    typeface: "Aptos",
    color,
    bold: true,
    align: "center",
  });
}

async function addPhoneShot(slide, fileName, left, top, width, height, options = {}) {
  const { blob } = await imageConfig(fileName, options.processed);
  plainRect(slide, left + 10, top + 10, width, height, "#00000066");
  const frame = rect(slide, left, top, width, height, "#0A0F0D", "#2D2D2D");
  frame.adjustmentList = [{ name: "adj", formula: "val 18000" }];
  const image = slide.images.add({
    blob,
    fit: options.fit ?? "contain",
    alt: fileName,
  });
  image.position = { left: left + 12, top: top + 12, width: width - 24, height: height - 24 };
  image.geometry = "roundRect";
  image.adjustmentList = [{ name: "adj", formula: "val 16000" }];
  plainRect(slide, left + width / 2 - 40, top + 8, 80, 8, "#1B1B1B");
}

function addBulletCard(slide, title, body, left, top, width, height, accent) {
  addPanel(slide, left, top, width, height, "#10261E", COLORS.line);
  plainRect(slide, left, top, 10, height, accent);
  addText(slide, title, left + 26, top + 18, width - 40, 26, {
    fontSize: 17,
    typeface: "Aptos Display",
    color: COLORS.text,
    bold: true,
  });
  addBody(slide, body, left + 26, top + 54, width - 40, height - 70, COLORS.muted, 16);
}

function addStep(slide, idx, title, body, left, top, width, accent) {
  circle(slide, left, top, 34, 34, accent);
  addText(slide, String(idx), left, top + 6, 34, 20, {
    fontSize: 14,
    typeface: "Aptos Display",
    color: COLORS.darkText,
    bold: true,
    align: "center",
  });
  addText(slide, title, left + 48, top, width - 48, 22, {
    fontSize: 18,
    typeface: "Aptos Display",
    color: COLORS.text,
    bold: true,
  });
  addBody(slide, body, left + 48, top + 28, width - 48, 54, COLORS.muted, 15);
}

function addFooter(slide, text = "SmashMate · 产品介绍与操作指引") {
  addText(slide, text, 78, 678, 360, 18, {
    fontSize: 10,
    typeface: "Aptos",
    color: "#87B7A3",
  });
}

function addNotes(slide, text) {
  slide.speakerNotes.setText(text);
}

async function buildDeck() {
  await ensureDirs();
  const presentation = Presentation.create({ slideSize: { width: W, height: H } });

  {
    const slide = presentation.slides.add();
    slide.background.fill = COLORS.bg;
    circle(slide, -120, -120, 500, 500, COLORS.green, "24");
    circle(slide, 880, -60, 380, 380, COLORS.coachAccent, "18");
    circle(slide, 980, 500, 320, 320, COLORS.userAccent, "14");
    plainRect(slide, 58, 56, 1164, 608, "#081A14EE");
    addText(slide, "SmashMate", 92, 90, 320, 34, {
      fontSize: 18,
      typeface: "Aptos",
      color: COLORS.green2,
      bold: true,
    });
    addText(slide, "羽约", 92, 132, 420, 84, {
      fontSize: 48,
      typeface: "Aptos Display",
      color: COLORS.text,
      bold: true,
    });
    addText(slide, "产品介绍与用户 / 教练操作指引", 92, 214, 460, 42, {
      fontSize: 24,
      typeface: "Aptos Display",
      color: COLORS.warm,
      bold: true,
    });
    addBody(
      slide,
      "一站式连接羽毛球约球、找教练、课程管理与成长记录，\n把分散在群聊里的流程，整理成清晰、可追踪、可运营的产品体验。",
      92,
      284,
      470,
      110,
      COLORS.muted,
      19,
    );
    addMiniChip(slide, "普通用户视角", 92, 440, COLORS.userAccent);
    addMiniChip(slide, "教练工作台", 230, 440, COLORS.coachAccent);
    addBody(slide, "演示内容覆盖真实移动端页面与核心操作路径", 92, 484, 420, 28, "#A7CDBD", 15);
    await addPhoneShot(slide, "user-activities-viewport.png", 640, 94, 166, 352, { processed: true });
    await addPhoneShot(slide, "coach-my-courses-viewport.png", 834, 78, 182, 384, { processed: true });
    await addPhoneShot(slide, "coach-student-detail-viewport.png", 1022, 130, 168, 356, { processed: true });
    addPanel(slide, 612, 506, 580, 118, "#103125", COLORS.line);
    addText(slide, "核心叙事", 638, 528, 100, 22, {
      fontSize: 14,
      typeface: "Aptos",
      color: COLORS.green2,
      bold: true,
    });
    addBody(slide, "先从普通用户理解产品全貌，再进入教练模式看课程、学员与私教排课如何形成完整工作流。", 638, 558, 516, 44, COLORS.warm, 19);
    addFooter(slide);
    addNotes(slide, "封面：展示 SmashMate 的双视角结构，普通用户建立认知，教练端体现核心价值。");
  }

  {
    const slide = presentation.slides.add();
    addThemeBackground(slide, COLORS.green);
    addHeader(slide, "PRODUCT OVERVIEW", "为什么是 SmashMate", 2, COLORS.green);
    addBody(slide, "它不是单点工具，而是把球友、教练、课程与战绩都放进同一条连续体验里。", 76, 154, 540, 46, COLORS.muted, 18);
    addBulletCard(slide, "约球活动", "浏览活动、查看详情、加入参与，让线下约球从群消息变成结构化列表。", 76, 232, 348, 148, COLORS.userAccent);
    addBulletCard(slide, "找教练", "查看教练主页、团课与私教入口，用户能更快完成筛选、比较与预约。", 448, 232, 348, 148, COLORS.green);
    addBulletCard(slide, "成长记录", "报名课程、查看个人入口、沉淀战绩和通知，体验不止停留在一次约球。", 820, 232, 384, 148, COLORS.coachAccent);
    addPanel(slide, 76, 424, 1128, 178, "#10261E", COLORS.line);
    addText(slide, "相较微信群的价值变化", 104, 450, 240, 24, {
      fontSize: 20,
      typeface: "Aptos Display",
      color: COLORS.text,
      bold: true,
    });
    addBody(
      slide,
      "信息不再被刷屏淹没，而是按角色、场景和状态被组织起来。\n普通用户看到的是更容易发现和参与；教练看到的是更容易沉淀学员、安排课程和持续运营。",
      104,
      490,
      720,
      72,
      COLORS.warm,
      18,
    );
    addPanel(slide, 858, 446, 320, 128, "#17362C", COLORS.line);
    addText(slide, "三大关键词", 882, 468, 120, 20, {
      fontSize: 16,
      typeface: "Aptos Display",
      color: COLORS.green2,
      bold: true,
    });
    addText(slide, "发现\n连接\n沉淀", 882, 500, 200, 70, {
      fontSize: 28,
      typeface: "Aptos Display",
      color: COLORS.text,
      bold: true,
    });
    addFooter(slide);
    addNotes(slide, "来源：README 与 PRD，突出 SmashMate 的一站式价值。");
  }

  {
    const slide = presentation.slides.add();
    addThemeBackground(slide, COLORS.coachAccent);
    addHeader(slide, "ROLE MAP", "两种身份，共用同一平台", 3, COLORS.coachAccent);
    addBody(slide, "产品的表达重点是双角色协同：普通用户负责需求发生，教练负责服务供给与运营。", 76, 154, 560, 46, COLORS.muted, 18);
    addPanel(slide, 76, 228, 520, 360, "#0F241E", COLORS.line);
    addMiniChip(slide, "普通用户", 98, 250, COLORS.userAccent);
    addText(slide, "发现与参与", 98, 294, 220, 28, {
      fontSize: 28,
      typeface: "Aptos Display",
      color: COLORS.text,
      bold: true,
    });
    addStep(slide, 1, "找活动", "从活动列表快速判断时间、地点和人数，降低组织成本。", 98, 346, 430, COLORS.userAccent);
    addStep(slide, 2, "找教练", "进入教练主页看课程与私教入口，决策信息集中。", 98, 430, 430, COLORS.userAccent);
    addStep(slide, 3, "管自己", "在个人主页、报名入口和战绩页里持续回看自己的参与记录。", 98, 514, 430, COLORS.userAccent);
    addPanel(slide, 640, 228, 564, 360, "#13261F", COLORS.line);
    addMiniChip(slide, "教练", 662, 250, COLORS.coachAccent);
    addText(slide, "管理与运营", 662, 294, 220, 28, {
      fontSize: 28,
      typeface: "Aptos Display",
      color: COLORS.text,
      bold: true,
    });
    addStep(slide, 1, "管理课程", "团课、私教时间、私教课、学员班被收进同一个工作台。", 662, 346, 470, COLORS.coachAccent);
    addStep(slide, 2, "沉淀学员", "班级成员和我的学员形成稳定关系，而不是一次性沟通。", 662, 430, 470, COLORS.coachAccent);
    addStep(slide, 3, "持续安排", "从学员详情直接给 TA 排课，形成高频复用动作。", 662, 514, 470, COLORS.coachAccent);
    addFooter(slide);
    addNotes(slide, "这一页作为转场，先让观众理解双视角，再进入具体演示。");
  }

  {
    const slide = presentation.slides.add();
    addThemeBackground(slide, COLORS.userAccent);
    addHeader(slide, "USER VIEW", "普通用户首页与核心入口", 4, COLORS.userAccent);
    addBody(slide, "用户登录后先看到的是活动页和底部三大入口：约球、找教练、我的。", 76, 154, 500, 44, COLORS.muted, 18);
    await addPhoneShot(slide, "user-activities.png", 86, 216, 330, 430);
    addPanel(slide, 466, 228, 690, 160, "#10261E", COLORS.line);
    addText(slide, "这页负责建立第一印象", 494, 250, 360, 24, {
      fontSize: 21,
      typeface: "Aptos Display",
      color: COLORS.text,
      bold: true,
    });
    addBody(slide, "活动流是普通用户的默认首页，说明产品首先服务的是“发现和参与”。\n底部导航把用户最常用的三类动作固定下来，不需要在复杂菜单里找入口。", 494, 286, 608, 78, COLORS.warm, 18);
    addBulletCard(slide, "约球", "浏览活动、按时间查看、快速进入详情。", 466, 420, 208, 126, COLORS.userAccent);
    addBulletCard(slide, "找教练", "切换到教练列表，继续往课程和私教场景深入。", 696, 420, 208, 126, COLORS.green);
    addBulletCard(slide, "我的", "进入个人资料、报名记录和设置等个人侧入口。", 926, 420, 230, 126, COLORS.coachAccent);
    addFooter(slide);
    addNotes(slide, "真实页面：普通用户活动页。重点讲三个底部入口。");
  }

  {
    const slide = presentation.slides.add();
    addThemeBackground(slide, COLORS.userAccent);
    addHeader(slide, "USER FLOW 01", "约球与活动参与", 5, COLORS.userAccent);
    addBody(slide, "从活动列表到活动详情，用户可以快速完成“发现一场球局并决定是否参与”。", 76, 154, 560, 44, COLORS.muted, 18);
    await addPhoneShot(slide, "user-activities.png", 70, 220, 248, 392);
    await addPhoneShot(slide, "user-activity-detail.png", 344, 220, 248, 392);
    addPanel(slide, 630, 220, 548, 392, "#0F241E", COLORS.line);
    addStep(slide, 1, "浏览活动列表", "看到时间、地点、人数和状态，优先完成快速筛选。", 660, 256, 480, COLORS.userAccent);
    addStep(slide, 2, "进入活动详情", "详情页把参与者、活动说明和后续动作聚合起来。", 660, 344, 480, COLORS.userAccent);
    addStep(slide, 3, "继续互动", "活动结束后还可以回到详情页继续录入或查看战绩。", 660, 432, 480, COLORS.userAccent);
    addPanel(slide, 660, 520, 482, 70, "#17362C", COLORS.line);
    addBody(slide, "这条链路说明：SmashMate 不是单纯展示信息，而是把一场活动的前、中、后状态串起来。", 682, 540, 438, 34, COLORS.warm, 16);
    addFooter(slide);
    addNotes(slide, "真实页面：活动列表 + 活动详情。");
  }

  {
    const slide = presentation.slides.add();
    addThemeBackground(slide, COLORS.userAccent);
    addHeader(slide, "USER FLOW 02", "找教练与课程 / 私教入口", 6, COLORS.userAccent);
    addBody(slide, "普通用户并不是孤立约球，而是能直接从平台进入教练服务场景。", 76, 154, 540, 44, COLORS.muted, 18);
    await addPhoneShot(slide, "user-coaches.png", 72, 216, 248, 400);
    await addPhoneShot(slide, "user-coach-profile.png", 348, 216, 248, 400);
    addPanel(slide, 634, 216, 544, 400, "#0F241E", COLORS.line);
    addText(slide, "用户看到的是一条连续路径", 662, 242, 320, 22, {
      fontSize: 21,
      typeface: "Aptos Display",
      color: COLORS.text,
      bold: true,
    });
    addBulletCard(slide, "教练列表", "按标签、评分和学员数浏览，降低找人的不确定性。", 662, 286, 482, 88, COLORS.userAccent);
    addBulletCard(slide, "教练主页", "集中展示简介、课程、私教入口和评价，帮助用户判断是否适合。", 662, 392, 482, 100, COLORS.green);
    addBulletCard(slide, "下一步动作", "可以继续查看团课详情，也可以直接走预约私教流程。", 662, 510, 482, 88, COLORS.coachAccent);
    addFooter(slide);
    addNotes(slide, "真实页面：教练列表与教练主页，体现普通用户如何进入服务场景。");
  }

  {
    const slide = presentation.slides.add();
    addThemeBackground(slide, COLORS.userAccent);
    addHeader(slide, "USER FLOW 03", "个人中心与成长记录", 7, COLORS.userAccent);
    addBody(slide, "用户侧不只有“参加一次”，还保留了个人资料、入口导航和战绩回看。", 76, 154, 560, 44, COLORS.muted, 18);
    await addPhoneShot(slide, "user-profile.png", 80, 214, 266, 406);
    await addPhoneShot(slide, "user-match-records.png", 374, 214, 266, 406);
    addPanel(slide, 676, 214, 502, 406, "#0F241E", COLORS.line);
    addStep(slide, 1, "个人主页", "汇总头像、昵称、基础战绩和常用入口，是用户端的个人工作台。", 704, 252, 440, COLORS.userAccent);
    addStep(slide, 2, "快捷入口", "我的活动、我的课程、战绩记录、设置等动作被集中组织。", 704, 350, 440, COLORS.userAccent);
    addStep(slide, 3, "战绩回看", "即使暂无记录，页面结构也已经预留了长期沉淀成长数据的位置。", 704, 448, 440, COLORS.userAccent);
    addFooter(slide);
    addNotes(slide, "真实页面：个人主页与战绩页。");
  }

  {
    const slide = presentation.slides.add();
    addThemeBackground(slide, COLORS.coachAccent);
    addHeader(slide, "COACH MODE", "从普通模式切到教练工作台", 8, COLORS.coachAccent);
    addBody(slide, "教练模式不是新账号，而是同一个账号在“用户视角”和“工作视角”之间切换。", 76, 154, 640, 44, COLORS.muted, 18);
    await addPhoneShot(slide, "coach-settings.png", 78, 212, 278, 420);
    addPanel(slide, 398, 222, 744, 182, "#10261E", COLORS.line);
    addText(slide, "切换前后，底部导航会重新组织", 426, 248, 400, 22, {
      fontSize: 21,
      typeface: "Aptos Display",
      color: COLORS.text,
      bold: true,
    });
    addPanel(slide, 426, 286, 312, 88, "#163226", COLORS.line);
    addText(slide, "普通模式", 448, 304, 100, 18, {
      fontSize: 14,
      typeface: "Aptos",
      color: COLORS.userAccent,
      bold: true,
    });
    addText(slide, "约球  ·  找教练  ·  我的", 448, 330, 246, 20, {
      fontSize: 18,
      typeface: "Aptos Display",
      color: COLORS.warm,
      bold: true,
    });
    addPanel(slide, 764, 286, 342, 88, "#163226", COLORS.line);
    addText(slide, "教练模式", 786, 304, 100, 18, {
      fontSize: 14,
      typeface: "Aptos",
      color: COLORS.coachAccent,
      bold: true,
    });
    addText(slide, "课程  ·  学员  ·  我的", 786, 330, 274, 20, {
      fontSize: 18,
      typeface: "Aptos Display",
      color: COLORS.warm,
      bold: true,
    });
    addBulletCard(slide, "意义", "把高频工作入口前置，让教练不再绕进个人页的深层链接。", 398, 430, 234, 130, COLORS.coachAccent);
    addBulletCard(slide, "结果", "课程管理和学员管理变成主导航，而不是次级菜单。", 654, 430, 234, 130, COLORS.green);
    addBulletCard(slide, "默认首页", "打开 App 时直接进入课程管理，工作节奏更顺手。", 910, 430, 232, 130, COLORS.userAccent);
    addFooter(slide);
    addNotes(slide, "真实页面：设置页教练模式开关。对比普通模式与教练模式导航。");
  }

  {
    const slide = presentation.slides.add();
    addThemeBackground(slide, COLORS.coachAccent);
    addHeader(slide, "COACH HUB", "课程管理工作台总览", 9, COLORS.coachAccent);
    addBody(slide, "教练模式的核心首页是课程管理页，四个 Tab 对应四类高频工作。", 76, 154, 570, 44, COLORS.muted, 18);
    await addPhoneShot(slide, "coach-my-courses.png", 70, 214, 332, 420);
    addBulletCard(slide, "团课", "发布、修改和查看公开课程，承接多人报名场景。", 446, 236, 344, 110, COLORS.userAccent);
    addBulletCard(slide, "私教时间", "维护可预约时段，让学员能够从教练主页继续下单。", 816, 236, 344, 110, COLORS.green);
    addBulletCard(slide, "私教课", "查看已经形成的私教安排，进入具体课程详情。", 446, 370, 344, 110, COLORS.coachAccent);
    addBulletCard(slide, "学员班", "围绕长期班级管理成员和排课，是后续演示的重点入口。", 816, 370, 344, 110, COLORS.green2);
    addPanel(slide, 446, 522, 714, 92, "#17362C", COLORS.line);
    addBody(slide, "这一页决定了教练对产品的第一感受：入口够不够近、工作流是不是连续。", 470, 548, 666, 34, COLORS.warm, 18);
    addFooter(slide);
    addNotes(slide, "真实页面：课程管理页。重点介绍四个 Tab。");
  }

  {
    const slide = presentation.slides.add();
    addThemeBackground(slide, COLORS.coachAccent);
    addHeader(slide, "COACH FLOW 01", "学员班管理：创建班级并进入详情", 10, COLORS.coachAccent);
    addBody(slide, "学员班是教练做长期运营的起点，先建班，再围绕班级持续加学员和排课程。", 76, 154, 620, 44, COLORS.muted, 18);
    await addPhoneShot(slide, "coach-student-classes.png", 66, 222, 228, 362);
    await addPhoneShot(slide, "coach-create-class-modal.png", 320, 222, 228, 362);
    await addPhoneShot(slide, "coach-class-detail-students.png", 574, 222, 228, 362);
    addPanel(slide, 840, 222, 336, 362, "#10261E", COLORS.line);
    addStep(slide, 1, "进入学员班 Tab", "在课程管理里切到学员班，就能看到已有班级和创建入口。", 868, 258, 274, COLORS.coachAccent);
    addStep(slide, 2, "创建班级", "输入班级名称，先把长期训练单元建立起来。", 868, 356, 274, COLORS.coachAccent);
    addStep(slide, 3, "进入详情页", "班级详情默认先看成员页，为后续添加学员做准备。", 868, 454, 274, COLORS.coachAccent);
    addFooter(slide);
    addNotes(slide, "真实页面：学员班列表、创建学员班弹窗、班级详情页。");
  }

  {
    const slide = presentation.slides.add();
    addThemeBackground(slide, COLORS.coachAccent);
    addHeader(slide, "COACH FLOW 02", "添加学员与班级课程", 11, COLORS.coachAccent);
    addBody(slide, "班级不是静态容器，而是可以不断补充成员、补充课程，形成稳定运营节奏。", 76, 154, 620, 44, COLORS.muted, 18);
    await addPhoneShot(slide, "coach-add-student-modal.png", 66, 222, 228, 362);
    await addPhoneShot(slide, "coach-class-create-lesson-modal.png", 320, 222, 228, 362);
    await addPhoneShot(slide, "coach-class-detail-lessons.png", 574, 222, 228, 362);
    addPanel(slide, 840, 222, 336, 362, "#10261E", COLORS.line);
    addText(slide, "这页强调“班级运营”", 868, 250, 230, 22, {
      fontSize: 21,
      typeface: "Aptos Display",
      color: COLORS.text,
      bold: true,
    });
    addBody(
      slide,
      "添加学员时可以按昵称或手机号搜索，适合线下认识后快速录入。\n\n创建课程时需要时间、球馆和训练内容，班级从“有学员”走向“有教学安排”。",
      868,
      292,
      270,
      150,
      COLORS.warm,
      17,
    );
    addBulletCard(slide, "成员沉淀", "班级成员不是一次性报名，而是可以持续维护。", 868, 472, 270, 74, COLORS.green);
    addBulletCard(slide, "课程节奏", "同一班级下累积多节课，天然适合长期训练。", 868, 558, 270, 74, COLORS.userAccent);
    addFooter(slide);
    addNotes(slide, "真实页面：添加学员弹窗、创建课程弹窗、班级课程列表。");
  }

  {
    const slide = presentation.slides.add();
    addThemeBackground(slide, COLORS.coachAccent);
    addHeader(slide, "COACH FLOW 03", "我的学员：统一沉淀学员关系", 12, COLORS.coachAccent);
    addBody(slide, "除了班级维度，教练还有一个跨课程、跨来源的统一学员视图。", 76, 154, 560, 44, COLORS.muted, 18);
    await addPhoneShot(slide, "coach-my-students.png", 72, 214, 266, 406);
    await addPhoneShot(slide, "coach-student-detail.png", 364, 214, 266, 406);
    addPanel(slide, 670, 214, 508, 406, "#10261E", COLORS.line);
    addStep(slide, 1, "列表页先做筛选", "搜索、标签和来源信息让教练先找到想管理的学员。", 698, 250, 444, COLORS.coachAccent);
    addStep(slide, 2, "详情页看关系", "学员详情展示来源、标签、所属学员班和历史课程。", 698, 352, 444, COLORS.coachAccent);
    addStep(slide, 3, "下一步动作清晰", "从详情页继续安排课程，而不是跳回其他页面重新找入口。", 698, 454, 444, COLORS.coachAccent);
    addFooter(slide);
    addNotes(slide, "真实页面：我的学员列表 + 学员详情。");
  }

  {
    const slide = presentation.slides.add();
    addThemeBackground(slide, COLORS.coachAccent);
    addHeader(slide, "COACH FLOW 04", "给 TA 排私教课：从学员详情直接安排", 13, COLORS.coachAccent);
    addBody(slide, "这是教练端最有代表性的高频动作：围绕具体学员，直接完成下节私教安排。", 76, 154, 620, 44, COLORS.muted, 18);
    await addPhoneShot(slide, "coach-student-detail.png", 60, 220, 220, 360);
    await addPhoneShot(slide, "coach-private-lesson-modal.png", 304, 220, 220, 360);
    await addPhoneShot(slide, "coach-student-detail-upcoming.png", 548, 220, 220, 360);
    addPanel(slide, 812, 220, 368, 360, "#10261E", COLORS.line);
    addText(slide, "为什么这页最重要", 840, 246, 220, 22, {
      fontSize: 21,
      typeface: "Aptos Display",
      color: COLORS.text,
      bold: true,
    });
    addBody(
      slide,
      "因为它把“学员关系”直接转成“课程动作”。\n\n教练不需要先去维护一堆时段，再倒推对应学员；而是从学员详情出发，输入时间、球馆和训练内容，立刻生成下一节课。",
      840,
      288,
      300,
      130,
      COLORS.warm,
      17,
    );
    addBulletCard(slide, "更短路径", "入口就在学员详情页，动作集中。", 840, 450, 300, 74, COLORS.coachAccent);
    addBulletCard(slide, "更强运营感", "生成下节课后，学员关系会继续沉淀在同一页面。", 840, 536, 300, 74, COLORS.green);
    addFooter(slide);
    addNotes(slide, "真实页面：学员详情、给 TA 排课弹窗、排课后出现的下节课卡片。");
  }

  {
    const slide = presentation.slides.add();
    addThemeBackground(slide, COLORS.green);
    addHeader(slide, "SUMMARY", "SmashMate 把两端流程都结构化了", 14, COLORS.green);
    addBody(slide, "最后回到产品价值：普通用户更容易参与，教练更容易管理，平台更容易形成长期关系。", 76, 154, 660, 44, COLORS.muted, 18);
    addBulletCard(slide, "对普通用户", "更容易发现活动和教练，入口明确，路径连续，参与感更强。", 76, 232, 336, 156, COLORS.userAccent);
    addBulletCard(slide, "对教练", "课程、学员、班级和私教安排被统一组织，工作台心智更完整。", 438, 232, 336, 156, COLORS.coachAccent);
    addBulletCard(slide, "对平台", "把分散在群聊里的组织动作，沉淀成可追踪、可回看、可复用的流程。", 800, 232, 376, 156, COLORS.green);
    addPanel(slide, 76, 430, 1100, 170, "#10261E", COLORS.line);
    addText(slide, "一句话总结", 104, 456, 180, 22, {
      fontSize: 20,
      typeface: "Aptos Display",
      color: COLORS.text,
      bold: true,
    });
    addBody(
      slide,
      "SmashMate 用“普通用户入口 + 教练工作台”的双视角设计，把约球、找教练、上课和学员管理串成了一条真正可落地的业务链路。",
      104,
      494,
      700,
      56,
      COLORS.warm,
      22,
    );
    await addPhoneShot(slide, "user-coaches-viewport.png", 920, 438, 104, 148, { processed: true });
    await addPhoneShot(slide, "coach-my-courses-viewport.png", 1044, 438, 104, 148, { processed: true });
    addFooter(slide, "SmashMate · presentation2");
    addNotes(slide, "总结页：分别收束用户价值、教练价值与平台价值。");
  }

  for (let i = 0; i < presentation.slides.items.length; i += 1) {
    const slide = presentation.slides.items[i];
    const png = await presentation.export({ slide, format: "png", scale: 1 });
    const bytes = new Uint8Array(await png.arrayBuffer());
    await fs.writeFile(path.join(PREVIEW_DIR, `slide-${String(i + 1).padStart(2, "0")}.png`), bytes);
  }

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(OUTPUT);
  console.log(OUTPUT);
}

buildDeck().catch((error) => {
  console.error(error);
  process.exit(1);
});
