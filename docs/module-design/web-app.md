# 模块详细设计: web-app

> 本文档描述 web-app 前端模块的整体架构。各 feature 的页面细节见 `web-app-{feature}.md`。
> 系统级架构见 architecture.md。

## 1. 模块概述

- **职责**: 用户端 SPA，提供约球、找教练、战绩记录、通知查看、个人主页等面向普通用户和教练用户的全部功能
- **类型**: 前端模块
- **业务模块映射**: PRD 中的用户管理（FA）、约球（FB）、教练管理（FC）、战绩记录（FD）、球馆管理（FE-搜索部分）、通知（FF）、评价评分（FG）

---

## 2. Feature 划分

| Feature | 包含页面 | 对应后端模块 | 说明 |
|---------|---------|------------|------|
| auth | 注册/登录页 | user | 手机号+验证码的注册登录流程 |
| activity | 约球列表页、发起约球页、活动详情页 | activity, venue | 约球活动的浏览、创建、参与、战绩查看 |
| coaching | 教练列表页、教练主页、团课详情页、私教预约页、我的课程管理页 | coaching, venue, review | 教练浏览、课程报名/预约、评价 |
| match-record | 战绩录入页、战绩历史列表页 | match-record | 战绩的录入和历史查看 |
| profile | 个人主页、个人资料编辑页、教练资料编辑页、设置页 | user, coaching, match-record | 用户/教练资料管理、战绩汇总展示 |
| notification | 通知列表页 | notification | 通知消息的查看和已读管理 |

**划分原则**: Feature 划分与后端业务模块一一对应。auth 对应 user 模块的认证功能，profile 对应 user 模块的资料管理功能（两者拆分是因为 auth 为未登录态页面，profile 为登录态页面，生命周期和路由保护策略不同）。coaching feature 聚合了教练浏览、课程管理、评价提交等功能，因为它们共享教练主页这一核心入口页面。

---

## 3. 内部架构

### 目录结构

```
web/
├── features/          # 按业务域组织
│   ├── auth/
│   │   ├── pages/             # 注册/登录页
│   │   ├── components/        # 验证码输入、手机号输入等
│   │   ├── hooks/             # 登录/注册逻辑
│   │   └── api/               # 认证相关 API 调用
│   ├── activity/
│   │   ├── pages/             # 约球列表、发起约球、活动详情
│   │   ├── components/        # 活动卡片、筛选面板、参与者列表等
│   │   ├── hooks/             # 活动数据查询、加入/退出操作
│   │   └── api/               # 活动相关 API 调用
│   ├── coaching/
│   │   ├── pages/             # 教练列表、教练主页、团课详情、私教预约、课程管理
│   │   ├── components/        # 教练卡片、课程卡片、评价列表等
│   │   ├── hooks/             # 教练/课程查询、报名/预约操作
│   │   └── api/               # 教练/课程相关 API 调用
│   ├── match-record/
│   │   ├── pages/             # 战绩录入、战绩历史
│   │   ├── components/        # 比分输入、选手选择器等
│   │   ├── hooks/             # 战绩录入/查询逻辑
│   │   └── api/               # 战绩相关 API 调用
│   ├── profile/
│   │   ├── pages/             # 个人主页、资料编辑、教练资料编辑、设置
│   │   ├── components/        # 战绩汇总卡片、资料表单等
│   │   ├── hooks/             # 用户资料查询/更新
│   │   └── api/               # 用户资料相关 API 调用
│   └── notification/
│       ├── pages/             # 通知列表
│       ├── components/        # 通知项
│       ├── hooks/             # 通知查询/已读操作
│       └── api/               # 通知相关 API 调用
├── shared/            # 共享组件、hooks、工具函数、类型
│   ├── components/    # 全局复用的 UI 组件
│   ├── hooks/         # 共享 hooks
│   ├── utils/         # 工具函数
│   └── types/         # 跨 feature 共享的类型定义
├── stores/            # 全局状态管理（跨 feature 共享）
├── routes.ts          # 统一路由
└── main.tsx
```

| 层 | 职责 | 依赖 |
|----|------|------|
| Pages | 页面组件（React Router 路由对应），组合子组件 | Components, Hooks |
| Components | Ant Design 基础上的业务组件，只接收 props，不直接调用 API | -- |
| Hooks | TanStack Query 数据获取 + 业务逻辑封装 | API, Stores |
| API | 封装后端接口调用（fetch / axios），处理请求/响应转换 | 后端模块接口 |
| Stores | Zustand 跨页面共享状态（仅在需要时使用） | -- |

### 控制流

```
用户操作 → Page → Hook（useQuery/useMutation）→ API 层（fetch）→ TanStack Query 缓存更新 → 重新渲染
```

---

## 4. 路由结构

| 路由 | 页面组件 | 所属 Feature | 功能描述 | 认证要求 |
|------|---------|-------------|---------|---------|
| /login | LoginPage | auth | 手机号+验证码 注册/登录 | 不需要 |
| /activities | ActivityListPage | activity | 约球活动列表（筛选、排序） | 需要 |
| /activities/create | CreateActivityPage | activity | 发起约球活动 | 需要 |
| /activities/:id | ActivityDetailPage | activity | 活动详情（参与者列表、战绩列表） | 需要 |
| /coaches | CoachListPage | coaching | 教练列表（筛选、排序） | 需要 |
| /coaches/:id | CoachProfilePage | coaching | 教练主页（简介、课程、评价） | 需要 |
| /group-classes/:id | GroupClassDetailPage | coaching | 团课详情（报名） | 需要 |
| /coaches/:id/private-lessons | PrivateLessonBookingPage | coaching | 私教预约（选择时间段） | 需要 |
| /my-activities | MyActivityListPage | activity | 我的活动（发起的 + 参加的），对应 `GET /api/users/:id/activities` | 需要 |
| /my-courses | MyCourseManagementPage | coaching | 我的课程管理（教练角色） | 需要（教练） |
| /my-enrollments | MyEnrollmentListPage | coaching | 我的课程报名（学员视角），对应 `GET /api/users/:id/enrollments` | 需要 |
| /match-records/create | CreateMatchRecordPage | match-record | 战绩录入 | 需要 |
| /users/:id/match-records | MatchRecordHistoryPage | match-record | 个人战绩历史列表 | 需要 |
| /users/:id | UserProfilePage | profile | 个人主页（基本信息、战绩汇总） | 需要 |
| /profile/edit | ProfileEditPage | profile | 个人资料编辑 | 需要 |
| /profile/coach-edit | CoachProfileEditPage | profile | 教练资料编辑 | 需要（教练） |
| /settings | SettingsPage | profile | 设置（教练角色开启等） | 需要 |
| /notifications | NotificationListPage | notification | 通知列表 | 需要 |

**路由保护策略**:
- 未登录用户访问需要认证的路由时，自动重定向到 `/login`
- 登录成功后重定向回原目标页面（默认首页 `/activities`）
- 非教练用户访问教练专属页面（如 `/my-courses`、`/profile/coach-edit`）时，提示并引导至设置页开启教练角色
- `/my-courses` 为教练管理自己发布的课程（教练角色），`/my-enrollments` 为学员查看自己报名的课程（学员视角），两者面向不同角色、互不重叠

---

## 5. 布局设计

**UI 原型**: 各页面原型图见 `docs/prototypes/` 目录

### 全局布局

```
AppLayout
├── TopBar                 # 顶部栏（页面标题、通知图标+未读角标、返回按钮）
├── Content                # 页面内容区域（由 React Router 渲染）
└── BottomTabBar           # 底部导航栏（仅主页面显示）
```

**说明**:
- TopBar 在所有页面显示，内容随页面变化（列表页显示标题，详情页显示返回按钮+标题）
- BottomTabBar 仅在三个主页面（约球列表、教练列表、我的）显示，其他页面隐藏
- 通知图标固定在 TopBar 右侧，显示未读通知数角标

### 导航结构

**底部导航（BottomTabBar）**:

| 菜单项 | 路由 | 图标 | 说明 |
|--------|------|------|------|
| 约球 | /activities | outlined 日历图标 | 约球活动列表，默认首页 |
| 找教练 | /coaches | outlined 用户组图标 | 教练列表 |
| 我的 | /users/me | outlined 用户图标 | 当前用户的个人主页 |

**TopBar 通知入口**:

| 元素 | 路由 | 图标 | 说明 |
|------|------|------|------|
| 通知图标 | /notifications | outlined 铃铛图标 + Badge | 点击进入通知列表，Badge 显示未读数 |

---

## 6. 共享层设计

### 共享组件

| 组件 | 用途 | 使用方 |
|------|------|--------|
| AppLayout | 全局布局容器（TopBar + Content + BottomTabBar） | 所有 feature |
| TopBar | 顶部栏（标题、返回按钮、通知图标） | 所有 feature |
| BottomTabBar | 底部导航栏 | activity, coaching, profile |
| AuthGuard | 路由保护组件，未登录重定向到 /login | 所有需要认证的路由 |
| CoachGuard | 教练角色保护组件，非教练引导至设置页 | coaching（课程管理）, profile（教练资料编辑） |
| VenueSearchInput | 球馆搜索输入框（debounce 300ms，下拉匹配结果） | activity（发起约球）, coaching（发布团课、设置私教时间） |
| UserAvatar | 用户头像组件（头像 URL + fallback） | activity, coaching, profile, notification |
| StatusTag | 状态标签组件（不同状态不同颜色） | activity, coaching |
| EmptyState | 空状态占位组件 | 所有列表页 |
| LoadingSpinner | 加载状态组件 | 所有 feature |
| PageError | 页面级错误展示组件 | 所有 feature |
| ConfirmDialog | 确认操作弹窗（取消活动、退出活动等） | activity, coaching |

### 共享 Hooks

| Hook | 用途 | 使用方 |
|------|------|--------|
| useAuth | 获取当前登录用户信息、登录状态判断、退出登录 | 所有 feature |
| useCurrentUser | 获取当前用户详细信息（通过 TanStack Query 缓存 GET /api/users/me） | profile, coaching, activity |
| useUnreadCount | 获取未读通知数（轮询或页面切换时刷新） | AppLayout（TopBar 角标） |
| useGeolocation | 获取用户地理位置（经纬度），管理定位授权状态 | activity（距离排序/筛选）, coaching（无直接使用，但 VenueSearchInput 需要） |
| useInfiniteScroll | 列表无限滚动加载（基于 TanStack Query 的 useInfiniteQuery 封装） | activity, coaching, notification, match-record |

### 全局状态管理（Zustand）

| Store | 状态 | 用途 | 使用方 |
|-------|------|------|--------|
| authStore | `token: string \| null`, `userId: string \| null`, `isLoggedIn: boolean` | 认证令牌管理、登录状态持久化（localStorage） | 所有 feature（通过 useAuth hook 间接使用） |
| geolocationStore | `latitude: number \| null`, `longitude: number \| null`, `permission: 'granted' \| 'denied' \| 'prompt'`, `loading: boolean` | 用户定位信息缓存，避免重复请求浏览器定位 API | activity, VenueSearchInput |

**设计原则**:
- 页面内临时状态使用 useState（如表单输入、弹窗开关）
- 跨页面共享状态使用 Zustand（如认证信息、定位信息）
- 服务端数据使用 TanStack Query 管理（自动缓存、失效重新获取）
- 不在 Zustand 中缓存服务端数据，避免数据不一致

### API Client 配置

- **基础 URL**: `/api`（开发环境通过 Vite proxy 代理到后端开发服务器）
- **请求拦截器**:
  - 从 authStore 读取 token，自动附加 `Authorization: Bearer <token>` 请求头
  - 无 token 的请求不附加认证头（公开接口）
- **响应拦截器**:
  - 401 响应：清除 authStore 中的 token，重定向到 `/login`
  - 其他错误：提取 `error.code` 和 `error.message`，统一抛出便于各 feature 处理
- **错误处理策略**:
  - 表单提交错误：通过 useMutation 的 onError 回调处理，使用 Ant Design message 提示用户可读的错误信息
  - 数据加载错误：通过 useQuery 的 error 状态渲染 PageError 组件
  - 网络错误：统一提示"网络异常，请稍后重试"

---

## 7. 核心类型定义

```typescript
// ===== 用户相关 =====

interface User {
  id: string;
  phone: string;
  nickname: string;
  avatarUrl: string | null;
  bio: string | null;
  isCoach: boolean;
  createdAt: string;  // ISO 8601
  updatedAt: string;  // ISO 8601
}

// 用户公开信息（个人主页、头像展示等场景使用）
interface UserPublicInfo {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  bio: string | null;
  isCoach: boolean;
  createdAt: string;
}

// ===== 活动相关 =====

type ActivityStatus = 'open' | 'full' | 'in_progress' | 'completed' | 'cancelled';

// 活动中的球馆信息（后端返回 id, name, address, latitude, longitude）
interface ActivityVenue {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

interface Activity {
  id: string;
  creatorId: string;
  venue: ActivityVenue | null;
  title: string | null;
  startTime: string;
  endTime: string;
  maxParticipants: number;
  currentParticipants: number;
  status: ActivityStatus;
  distance?: number;           // 单位 km，仅当请求提供经纬度时后端返回
  createdAt: string;
}

interface ActivityDetail extends Activity {
  creator: { id: string; nickname: string; avatarUrl: string | null; };
  participants: ActivityParticipant[];
}

interface ActivityParticipant {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  joinedAt: string;
}

// ===== 教练相关 =====

type CoachSpecialty = 'singles' | 'doubles' | 'footwork' | 'fitness' | 'tactics';

interface CoachListItem {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  bio: string | null;
  specialties: CoachSpecialty[];
  studentCount: number;
  averageRating: number | null;   // 前端聚合字段，非后端 GET /api/coaches 直接返回；需通过 POST /api/coaches/ratings 批量查询后在前端合并
  totalCount: number;             // 前端聚合字段，非后端 GET /api/coaches 直接返回；需通过 POST /api/coaches/ratings 批量查询后在前端合并
}

interface CoachProfile {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  bio: string | null;
  specialties: CoachSpecialty[];
  studentCount: number;
  groupClasses: GroupClass[];              // 团课列表（未来 + 最近 30 天内结束的）
  privateLessonSlots: PrivateLessonSlot[]; // 未来且未被预约的私教空闲时间段
  createdAt: string;
}

// ===== 课程相关 =====

type GroupClassStatus = 'open' | 'full' | 'in_progress' | 'completed' | 'cancelled';
type PrivateLessonStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

interface GroupClass {
  id: string;
  coachId: string;
  title: string;
  venue: SlotVenue | null;       // 后端 GET /api/coaches/:id 返回的 groupClasses 中 venue 包含 id, name, address
  startTime: string;
  endTime: string;
  maxStudents: number;
  currentStudents: number;
  feeDescription: string | null;
  status: GroupClassStatus;
  createdAt: string;
}

// 可用时间段中球馆信息（后端 GET /api/coaches/:id/availability 返回 id, name, address）
interface SlotVenue {
  id: string;
  name: string;
  address: string;
}

interface PrivateLessonSlot {
  id: string;
  startTime: string;
  endTime: string;
  venues: SlotVenue[];        // 可选球馆列表（与后端 GET /api/coaches/:id 响应一致，后端将 venueIds 转换为 SlotVenue[] 返回）
  feeDescription: string | null;
  isBooked: boolean;
}

interface PrivateLesson {
  id: string;
  coachId: string;
  studentId: string;
  venue: VenueBrief | null;
  startTime: string;
  endTime: string;
  status: PrivateLessonStatus;
  createdAt: string;
}

// 团课详情（GET /api/group-classes/:id 响应，扩展 GroupClass 增加教练和报名学员信息）
interface GroupClassDetail extends GroupClass {
  coach: {
    id: string;
    nickname: string;
    avatarUrl: string | null;
  };
  venue: {                        // 详情接口返回完整球馆信息（覆盖 GroupClass 中的 VenueBrief）
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  } | null;
  enrollments: {
    userId: string;
    nickname: string;
    avatarUrl: string | null;
    enrolledAt: string;
  }[];
}

// 教练私教预约列表项（GET /api/coaches/:id/private-lessons 响应的 items 元素，教练视角）
interface CoachPrivateLesson {
  id: string;
  slot: {
    startTime: string;
    endTime: string;
  };
  venue: {
    id: string;
    name: string;
    address: string;
  } | null;
  student: {
    id: string;
    nickname: string;
    avatarUrl: string | null;
  };
  status: PrivateLessonStatus;
  createdAt: string;
}

// 课程报名列表项（GET /api/users/:id/enrollments 响应的 items 元素）
interface EnrollmentListItem {
  type: 'group-class' | 'private-lesson';
  groupClass: {
    id: string;
    title: string;
    coachId: string;
    coachNickname: string;
    venue: VenueBrief | null;
    startTime: string;
    endTime: string;
    status: GroupClassStatus;
    enrolledAt: string;
  } | null;
  privateLesson: {
    id: string;
    coachId: string;
    coachNickname: string;
    venue: VenueBrief | null;
    startTime: string;
    endTime: string;
    status: PrivateLessonStatus;
    createdAt: string;
  } | null;
}

// ===== 球馆相关 =====

interface VenueBrief {
  id: string;
  name: string;
}

interface Venue {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  cityName: string;
  distance?: number;  // 搜索结果中可能包含距离（单位：米）
}

// ===== 战绩相关 =====

type MatchType = 'singles' | 'doubles';
type SourceType = 'activity' | 'group-class' | 'private-lesson';

interface MatchRecord {
  id: string;
  sourceType: SourceType;
  sourceId: string;
  matchType: MatchType;
  recordedBy: string;
  recorder: {
    id: string;
    nickname: string;
    avatarUrl: string | null;
  };
  players: {
    sideA: MatchPlayer[];
    sideB: MatchPlayer[];
  };
  games: MatchGame[];
  result: 'A_WIN' | 'B_WIN' | 'DRAW';
  userResult?: 'WIN' | 'LOSE' | 'DRAW';  // 仅在个人战绩历史接口（GET /api/users/:id/match-records）返回时有值，表示该用户在本场的结果
  createdAt: string;
}

interface MatchPlayer {
  userId?: string;              // 平台用户 ID（平台用户时存在）
  guestId?: string;             // 非平台用户 ID（临时用户时存在）
  nickname: string;             // 展示用昵称
  avatarUrl?: string | null;    // 头像 URL（平台用户时存在）
}

interface MatchGame {
  gameNumber: number;  // 局号（从 1 开始）
  scoreA: number;      // A 方得分（0-30）
  scoreB: number;      // B 方得分（0-30）
}

interface MatchStats {
  totalMatches: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;     // 0-100 之间的百分比值，保留一位小数；胜场/(胜场+负场)*100
}

// ===== 通知相关 =====

type NotificationTargetType =
  | 'activity'
  | 'group-class'
  | 'private-lesson'
  | 'coach-profile';

interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  isRead: boolean;
  targetType: NotificationTargetType;
  targetId: string;
  createdAt: string;
}

// ===== 评价相关 =====

interface Review {
  id: string;
  reviewer: {
    id: string;
    nickname: string;
    avatarUrl: string | null;
  };
  courseType: 'group-class' | 'private-lesson';
  courseId: string;
  rating: number;          // 1-5
  comment: string | null;
  createdAt: string;
}

interface CoachRating {
  coachId: string;
  averageRating: number | null;  // null 表示暂无评价
  totalCount: number;
}

// ===== 分页相关 =====

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ===== API 响应 =====

interface ApiSuccessResponse<T> {
  data: T;
}

interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}
```

---

## 8. 模块特有约定

- **响应式布局**: 优先适配移动端浏览器（视口宽度 375px-428px），兼容桌面端；使用 Ant Design 的栅格系统和响应式断点
- **浏览器兼容**: 支持 Chrome、Safari、微信内置浏览器（移动端）；桌面端支持 Chrome、Edge
- **性能约束**:
  - 页面首次加载时间不超过 3 秒（4G 网络）
  - 路由级别代码分割（React.lazy + Suspense），按需加载各 feature 的页面组件
  - 列表页使用分页或无限滚动加载，单次请求不超过 20 条
  - TanStack Query 缓存策略：staleTime 设为 30 秒（列表数据），避免频繁重复请求
- **交互约定**:
  - 球馆搜索输入框 debounce 300ms
  - 列表支持下拉刷新（mobile）和上拉加载更多
  - 通知未读角标在页面加载和底部 Tab 切换时刷新（不使用 WebSocket，一期仅轮询）
  - 操作反馈使用 Ant Design message 全局提示（成功/错误/警告）
  - 破坏性操作（取消活动、删除战绩等）须二次确认弹窗
- **视觉风格**:
  - 主色：活力绿（#00C853）
  - 辅色：明亮蓝（#2979FF）
  - 强调色：活力橙（#FF6D00）
  - 卡片圆角 12px，按钮使用圆角胶囊形或大圆角矩形
  - 图标风格统一使用线性图标（outlined）
  - 通过 Ant Design ConfigProvider 全局配置主题色
- **教练评分聚合**:
  - 教练列表页（`CoachListPage`）获取教练列表后，需要将评分数据合并到 `CoachListItem` 中渲染
  - 数据获取流程：并行发起 `GET /api/coaches`（教练列表）和 `POST /api/coaches/ratings`（批量教练评分查询，请求体为教练列表返回的所有 coachId）
  - 两个请求均完成后，前端按 coachId 匹配，将 `averageRating` 和 `totalCount` 合并到对应的教练列表项中
  - 这样设计是因为教练评分由 review 模块实时计算，coaching 模块不存冗余字段（参见架构约定）
- **定位相关**:
  - 定位授权在用户首次使用距离相关功能时触发（活动列表距离排序/筛选、球馆搜索距离排序）
  - 用户拒绝定位后，距离排序不可用（默认按时间排序），距离筛选项隐藏，活动卡片不显示距离信息
  - 定位结果缓存在 geolocationStore 中，同一会话内不重复请求
