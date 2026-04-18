import { AppError } from '../../infra/error-handler.js';
import { createModuleLogger } from '../../infra/logger.js';
import { registerTask } from '../../infra/scheduler.js';
import { ActivityRepository } from './repository.js';
import type {
  CreateActivityInput,
  UpdateActivityInput,
  ActivityListQuery,
  UserActivitiesQuery,
} from './types.js';

const logger = createModuleLogger('activity');

/**
 * Basic non-empty string check for IDs.
 * Actual existence is validated by calling the relevant service.
 */
function isValidId(id: string | undefined | null): boolean {
  return typeof id === 'string' && id.trim().length > 0;
}

interface VenueServiceDep {
  getVenueById(id: string): Promise<{
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  } | null>;
}

interface UserServiceDep {
  getUserById(id: string): Promise<{
    id: string;
    nickname: string;
    avatarUrl: string | null;
    bio: string | null;
    isCoach: boolean;
  } | null>;
  getUsersByIds(ids: string[]): Promise<Array<{
    id: string;
    nickname: string;
    avatarUrl: string | null;
    bio: string | null;
    isCoach: boolean;
  }>>;
}

interface NotificationServiceDep {
  create(input: {
    userId: string;
    type: string;
    title: string;
    content: string;
    targetType: string;
    targetId: string;
  }): Promise<unknown>;
  createBatch(notifications: Array<{
    userId: string;
    type: string;
    title: string;
    content: string;
    targetType: string;
    targetId: string;
  }>): Promise<unknown>;
}

/**
 * Format a date to MM/DD string.
 */
function formatDateMMDD(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}/${day}`;
}

export class ActivityService {
  private repo: ActivityRepository;
  private venueService: VenueServiceDep;
  private userService: UserServiceDep;
  private notificationService: NotificationServiceDep;

  constructor(
    repo: ActivityRepository,
    venueService: VenueServiceDep,
    userService: UserServiceDep,
    notificationService: NotificationServiceDep,
  ) {
    this.repo = repo;
    this.venueService = venueService;
    this.userService = userService;
    this.notificationService = notificationService;
  }

  // =========================================================================
  // POST /api/activities — Create activity
  // =========================================================================

  async createActivity(userId: string, input: CreateActivityInput) {
    // 1. Validate venueId
    if (!isValidId(input.venueId)) {
      throw new AppError(400, 'ACTIVITY_INVALID_VENUE', '球馆 ID 缺失或格式不合法');
    }

    // 2. Validate title
    if (input.title !== undefined && input.title !== null && input.title.length > 50) {
      throw new AppError(400, 'ACTIVITY_INVALID_TITLE', '活动标题不能超过 50 字符');
    }

    // 3. Validate time
    const startTime = new Date(input.startTime);
    const endTime = new Date(input.endTime);
    const now = new Date();

    if (startTime <= now) {
      throw new AppError(400, 'ACTIVITY_INVALID_TIME', '开始时间必须晚于当前时间');
    }
    if (endTime <= startTime) {
      throw new AppError(400, 'ACTIVITY_INVALID_TIME', '结束时间必须晚于开始时间');
    }

    // 4. Validate maxParticipants
    if (
      !Number.isInteger(input.maxParticipants) ||
      input.maxParticipants < 2 ||
      input.maxParticipants > 50
    ) {
      throw new AppError(400, 'ACTIVITY_INVALID_PARTICIPANTS', '限定人数必须在 2-50 之间');
    }

    // 5. Verify venue exists
    const venue = await this.venueService.getVenueById(input.venueId);
    if (!venue) {
      throw new AppError(404, 'ACTIVITY_VENUE_NOT_FOUND', '球馆不存在');
    }

    // 6. Create activity with creator as first participant
    const activity = await this.repo.create({
      creatorId: userId,
      venueId: input.venueId,
      title: input.title ?? null,
      startTime,
      endTime,
      maxParticipants: input.maxParticipants,
    });

    logger.info(
      { creatorId: userId.slice(0, 8), venueId: input.venueId, startTime: input.startTime },
      '活动已创建',
    );

    // 7. Get participant user info for response
    const participantIds = activity.participants.map((p) => p.userId);
    const users = await this.userService.getUsersByIds(participantIds);
    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      id: activity.id,
      creatorId: activity.creatorId,
      venue: {
        id: venue.id,
        name: venue.name,
        address: venue.address,
        latitude: venue.latitude,
        longitude: venue.longitude,
      },
      title: activity.title,
      startTime: activity.startTime,
      endTime: activity.endTime,
      maxParticipants: activity.maxParticipants,
      currentParticipants: activity.currentParticipants,
      status: activity.status,
      participants: activity.participants.map((p) => {
        const user = userMap.get(p.userId);
        return {
          userId: p.userId,
          nickname: user?.nickname ?? '未知用户',
          avatarUrl: user?.avatarUrl ?? null,
          joinedAt: p.joinedAt,
        };
      }),
      createdAt: activity.createdAt,
    };
  }

  // =========================================================================
  // GET /api/activities — Activity list
  // =========================================================================

  async getActivityList(query: ActivityListQuery) {
    // 1. Validate coordinates
    const hasLat = query.latitude !== undefined && query.latitude !== null;
    const hasLng = query.longitude !== undefined && query.longitude !== null;

    if (hasLat !== hasLng) {
      throw new AppError(400, 'ACTIVITY_INVALID_COORDINATES', '经纬度必须同时提供或同时不提供');
    }

    if (hasLat && hasLng) {
      if (query.latitude! < -90 || query.latitude! > 90 || query.longitude! < -180 || query.longitude! > 180) {
        throw new AppError(400, 'ACTIVITY_INVALID_COORDINATES', '经纬度格式不合法');
      }
    }

    // 2. Validate date range
    const hasDateStart = query.dateStart !== undefined && query.dateStart !== null;
    const hasDateEnd = query.dateEnd !== undefined && query.dateEnd !== null;

    if (!query.dateFilter) {
      if (hasDateStart !== hasDateEnd) {
        throw new AppError(400, 'ACTIVITY_INVALID_DATE_RANGE', 'dateStart 和 dateEnd 必须同时提供');
      }
      if (hasDateStart && hasDateEnd) {
        if (new Date(query.dateEnd!) < new Date(query.dateStart!)) {
          throw new AppError(400, 'ACTIVITY_INVALID_DATE_RANGE', 'dateEnd 不能早于 dateStart');
        }
      }
    }

    // 3. Normalize pagination
    const page = query.page ?? 1;
    let pageSize = query.pageSize ?? 20;
    if (pageSize > 100) pageSize = 100;

    // 4. Handle sortBy fallback
    let sortBy: 'time' | 'distance' = query.sortBy ?? 'time';
    if (sortBy === 'distance' && !hasLat) {
      sortBy = 'time';
    }

    // 5. Build repo params (dateFilter priority over dateStart/dateEnd)
    const repoParams = {
      page,
      pageSize,
      dateFilter: query.dateFilter,
      dateStart: query.dateFilter ? undefined : query.dateStart,
      dateEnd: query.dateFilter ? undefined : query.dateEnd,
      maxDistance: query.maxDistance,
      latitude: hasLat ? query.latitude : undefined,
      longitude: hasLng ? query.longitude : undefined,
      hasSlot: query.hasSlot,
      sortBy,
    };

    const result = await this.repo.findList(repoParams);

    return {
      items: result.items,
      total: result.total,
      page,
      pageSize,
    };
  }

  // =========================================================================
  // GET /api/activities/:id — Activity detail
  // =========================================================================

  async getActivityDetail(id: string) {
    const activity = await this.repo.findById(id);
    if (!activity) {
      throw new AppError(404, 'ACTIVITY_NOT_FOUND', '活动不存在');
    }

    // Get venue info
    let venue = null;
    if (activity.venueId) {
      venue = await this.venueService.getVenueById(activity.venueId);
    }

    // Get creator info
    const creator = await this.userService.getUserById(activity.creatorId);

    // Get participant user info
    const participantIds = activity.participants.map((p) => p.userId);
    const users = await this.userService.getUsersByIds(participantIds);
    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      id: activity.id,
      creatorId: activity.creatorId,
      creator: creator
        ? {
            id: creator.id,
            nickname: creator.nickname,
            avatarUrl: creator.avatarUrl,
          }
        : null,
      venue: venue
        ? {
            id: venue.id,
            name: venue.name,
            address: venue.address,
            latitude: venue.latitude,
            longitude: venue.longitude,
          }
        : null,
      title: activity.title,
      startTime: activity.startTime,
      endTime: activity.endTime,
      maxParticipants: activity.maxParticipants,
      currentParticipants: activity.currentParticipants,
      status: activity.status,
      participants: activity.participants.map((p) => {
        const user = userMap.get(p.userId);
        return {
          userId: p.userId,
          nickname: user?.nickname ?? '未知用户',
          avatarUrl: user?.avatarUrl ?? null,
          joinedAt: p.joinedAt,
        };
      }),
      createdAt: activity.createdAt,
    };
  }

  // =========================================================================
  // POST /api/activities/:id/join — Join activity
  // =========================================================================

  async joinActivity(activityId: string, userId: string) {
    const activity = await this.repo.findById(activityId);
    if (!activity) {
      throw new AppError(404, 'ACTIVITY_NOT_FOUND', '活动不存在');
    }

    // Check status
    if (activity.status === 'full') {
      throw new AppError(409, 'ACTIVITY_FULL', '活动已满员');
    }
    if (activity.status !== 'open') {
      throw new AppError(409, 'ACTIVITY_NOT_JOINABLE', '活动状态不允许加入');
    }

    // Check already joined
    const isParticipant = activity.participants.some((p) => p.userId === userId);
    if (isParticipant) {
      throw new AppError(409, 'ACTIVITY_ALREADY_JOINED', '用户已加入该活动');
    }

    // Add participant (repo handles count + status update in a single transaction)
    const result = await this.repo.addParticipant(activityId, userId);
    const newCount = result?.currentParticipants ?? activity.currentParticipants + 1;
    const newStatus = result?.status ?? (newCount >= activity.maxParticipants ? 'full' : activity.status);

    logger.info(
      { activityId, userId: userId.slice(0, 8), action: 'join' },
      '用户加入活动',
    );

    // Send notification to creator (unless creator is the one joining)
    if (activity.creatorId !== userId) {
      try {
        const joinerUser = await this.userService.getUserById(userId);
        const venueName = activity.venueId
          ? (await this.venueService.getVenueById(activity.venueId))?.name ?? '已删除的球馆'
          : '已删除的球馆';
        const dateStr = formatDateMMDD(activity.startTime);

        await this.notificationService.create({
          userId: activity.creatorId,
          type: 'ACTIVITY_JOINED',
          title: '新成员加入',
          content: `${joinerUser?.nickname ?? '未知用户'} 加入了你的活动「${venueName} ${dateStr}」`,
          targetType: 'activity',
          targetId: activityId,
        });
      } catch (err) {
        logger.error(
          { activityId, error: (err as Error).message },
          '发送加入通知失败',
        );
      }
    }

    return {
      activityId,
      userId,
      currentParticipants: newCount,
      status: newStatus,
      joinedAt: result?.joinedAt ?? new Date(),
    };
  }

  // =========================================================================
  // POST /api/activities/:id/leave — Leave activity
  // =========================================================================

  async leaveActivity(activityId: string, userId: string) {
    const activity = await this.repo.findById(activityId);
    if (!activity) {
      throw new AppError(404, 'ACTIVITY_NOT_FOUND', '活动不存在');
    }

    // Creator cannot leave
    if (activity.creatorId === userId) {
      throw new AppError(403, 'ACTIVITY_CREATOR_CANNOT_LEAVE', '发起人不可退出自己发起的活动');
    }

    // Check status
    if (activity.status !== 'open' && activity.status !== 'full') {
      throw new AppError(409, 'ACTIVITY_NOT_LEAVABLE', '活动状态不允许退出');
    }

    // Check is participant
    const isParticipant = activity.participants.some((p) => p.userId === userId);
    if (!isParticipant) {
      throw new AppError(409, 'ACTIVITY_NOT_PARTICIPANT', '用户不是该活动的参与者');
    }

    // Remove participant (repo handles count + status update in a single transaction)
    const result = await this.repo.removeParticipant(activityId, userId);
    const newCount = result?.currentParticipants ?? activity.currentParticipants - 1;
    const newStatus = result?.status ?? (activity.status === 'full' && newCount < activity.maxParticipants ? 'open' : activity.status);

    logger.info(
      { activityId, userId: userId.slice(0, 8), action: 'leave' },
      '用户退出活动',
    );

    // Send notification to creator
    try {
      const leaverUser = await this.userService.getUserById(userId);
      const venueName = activity.venueId
        ? (await this.venueService.getVenueById(activity.venueId))?.name ?? '已删除的球馆'
        : '已删除的球馆';
      const dateStr = formatDateMMDD(activity.startTime);

      await this.notificationService.create({
        userId: activity.creatorId,
        type: 'ACTIVITY_LEFT',
        title: '成员退出',
        content: `${leaverUser?.nickname ?? '未知用户'} 退出了你的活动「${venueName} ${dateStr}」`,
        targetType: 'activity',
        targetId: activityId,
      });
    } catch (err) {
      logger.error(
        { activityId, error: (err as Error).message },
        '发送退出通知失败',
      );
    }

    return {
      activityId,
      userId,
      currentParticipants: newCount,
      status: newStatus,
    };
  }

  // =========================================================================
  // PUT /api/activities/:id — Update activity
  // =========================================================================

  async updateActivity(activityId: string, userId: string, input: UpdateActivityInput) {
    const activity = await this.repo.findById(activityId);
    if (!activity) {
      throw new AppError(404, 'ACTIVITY_NOT_FOUND', '活动不存在');
    }

    // Only creator can update
    if (activity.creatorId !== userId) {
      throw new AppError(403, 'ACTIVITY_NOT_CREATOR', '非发起人不可修改活动');
    }

    // Check status
    if (activity.status !== 'open' && activity.status !== 'full') {
      throw new AppError(409, 'ACTIVITY_NOT_MODIFIABLE', '活动状态不允许修改');
    }

    // Validate venueId if provided
    if (input.venueId !== undefined) {
      if (!isValidId(input.venueId)) {
        throw new AppError(400, 'ACTIVITY_INVALID_VENUE', '球馆 ID 格式不合法');
      }
    }

    // Validate title if provided
    if (input.title !== undefined && input.title !== null && input.title.length > 50) {
      throw new AppError(400, 'ACTIVITY_INVALID_TITLE', '活动标题不能超过 50 字符');
    }

    // Validate maxParticipants if provided
    if (input.maxParticipants !== undefined) {
      if (!Number.isInteger(input.maxParticipants) || input.maxParticipants < 2 || input.maxParticipants > 50) {
        throw new AppError(400, 'ACTIVITY_INVALID_PARTICIPANTS', '限定人数必须在 2-50 之间');
      }
      if (input.maxParticipants < activity.currentParticipants) {
        throw new AppError(400, 'ACTIVITY_PARTICIPANTS_EXCEED', '限定人数不能小于当前参与人数');
      }
    }

    // Validate time fields
    const newStartTime = input.startTime ? new Date(input.startTime) : activity.startTime;
    const newEndTime = input.endTime ? new Date(input.endTime) : activity.endTime;

    if (input.startTime) {
      if (newStartTime <= new Date()) {
        throw new AppError(400, 'ACTIVITY_INVALID_TIME', '开始时间必须晚于当前时间');
      }
    }
    if (input.startTime || input.endTime) {
      if (newEndTime <= newStartTime) {
        throw new AppError(400, 'ACTIVITY_INVALID_TIME', '结束时间必须晚于开始时间');
      }
    }

    // Verify venue exists if changed
    if (input.venueId) {
      const venue = await this.venueService.getVenueById(input.venueId);
      if (!venue) {
        throw new AppError(404, 'ACTIVITY_VENUE_NOT_FOUND', '球馆不存在');
      }
    }

    // Determine new status based on maxParticipants change
    const newMaxParticipants = input.maxParticipants ?? activity.maxParticipants;
    let newStatus: string | undefined;

    if (activity.currentParticipants >= newMaxParticipants) {
      if (activity.status !== 'full') newStatus = 'full';
    } else if (activity.status === 'full') {
      newStatus = 'open';
    }

    // Build update data
    const updateData: {
      venueId?: string;
      title?: string;
      startTime?: Date;
      endTime?: Date;
      maxParticipants?: number;
      status?: string;
    } = {};

    if (input.venueId !== undefined) updateData.venueId = input.venueId;
    if (input.title !== undefined) updateData.title = input.title;
    if (input.startTime !== undefined) updateData.startTime = newStartTime;
    if (input.endTime !== undefined) updateData.endTime = newEndTime;
    if (input.maxParticipants !== undefined) updateData.maxParticipants = input.maxParticipants;
    if (newStatus !== undefined) updateData.status = newStatus;

    const updated = await this.repo.update(activityId, updateData);

    // Get venue info for response — prefer repo-included venue, fall back to venueService
    const fallbackVenueId = input.venueId ?? activity.venueId;
    const venue = updated.venue ?? (fallbackVenueId ? await this.venueService.getVenueById(fallbackVenueId) : null);

    logger.info(
      { activityId, userId: userId.slice(0, 8), action: 'update' },
      '活动已更新',
    );

    // Build response using repo return values directly (no redundant fallback)
    const response = {
      id: updated.id,
      creatorId: updated.creatorId,
      venue: venue
        ? {
            id: venue.id,
            name: venue.name,
            address: venue.address,
            latitude: venue.latitude,
            longitude: venue.longitude,
          }
        : null,
      title: updated.title,
      startTime: updated.startTime,
      endTime: updated.endTime,
      maxParticipants: updated.maxParticipants,
      currentParticipants: updated.currentParticipants,
      status: updated.status,
      createdAt: updated.createdAt,
    };

    // Notify all participants (except creator) using repo.getParticipantIds
    try {
      const allParticipantIds = await this.repo.getParticipantIds(activityId);
      const participantIds = allParticipantIds.filter((id) => id !== activity.creatorId);

      if (participantIds.length > 0) {
        const venueName = venue?.name ?? '已删除的球馆';
        const dateStr = formatDateMMDD(response.startTime);

        const notifications = participantIds.map((pUserId) => ({
          userId: pUserId,
          type: 'ACTIVITY_UPDATED' as const,
          title: '活动已更新',
          content: `你参加的活动「${venueName} ${dateStr}」信息已更新`,
          targetType: 'activity' as const,
          targetId: activityId,
        }));

        await this.notificationService.createBatch(notifications);
      }
    } catch (err) {
      logger.error(
        { activityId, error: (err as Error).message },
        '发送更新通知失败',
      );
    }

    return response;
  }

  // =========================================================================
  // POST /api/activities/:id/cancel — Cancel activity
  // =========================================================================

  async cancelActivity(activityId: string, userId: string) {
    const activity = await this.repo.findById(activityId);
    if (!activity) {
      throw new AppError(404, 'ACTIVITY_NOT_FOUND', '活动不存在');
    }

    // Only creator can cancel
    if (activity.creatorId !== userId) {
      throw new AppError(403, 'ACTIVITY_NOT_CREATOR', '非发起人不可取消活动');
    }

    // Already cancelled — idempotent
    if (activity.status === 'cancelled') {
      return { id: activity.id, status: 'cancelled' };
    }

    // Check status
    if (activity.status !== 'open' && activity.status !== 'full') {
      throw new AppError(409, 'ACTIVITY_NOT_CANCELLABLE', '活动状态不允许取消');
    }

    await this.repo.updateStatus(activityId, 'cancelled');

    logger.info(
      { activityId, userId: userId.slice(0, 8), action: 'cancel' },
      '活动已取消',
    );

    // Notify all participants (except creator) using repo.getParticipantIds
    try {
      const allParticipantIds = await this.repo.getParticipantIds(activityId);
      const participantIds = allParticipantIds.filter((id) => id !== activity.creatorId);

      if (participantIds.length > 0) {
        const venueName = activity.venueId
          ? (await this.venueService.getVenueById(activity.venueId))?.name ?? '已删除的球馆'
          : '已删除的球馆';
        const dateStr = formatDateMMDD(activity.startTime);

        const notifications = participantIds.map((pUserId) => ({
          userId: pUserId,
          type: 'ACTIVITY_CANCELLED' as const,
          title: '活动已取消',
          content: `你参加的活动「${venueName} ${dateStr}」已被取消`,
          targetType: 'activity' as const,
          targetId: activityId,
        }));

        await this.notificationService.createBatch(notifications);
      }
    } catch (err) {
      logger.error(
        { activityId, error: (err as Error).message },
        '发送取消通知失败',
      );
    }

    return { id: activityId, status: 'cancelled' };
  }

  // =========================================================================
  // GET /api/users/:id/activities — User activities
  // =========================================================================

  async getUserActivities(userId: string, query: UserActivitiesQuery) {
    const page = query.page ?? 1;
    let pageSize = query.pageSize ?? 20;
    if (pageSize > 100) pageSize = 100;

    const result = await this.repo.findUserActivities(userId, {
      page,
      pageSize,
      role: query.role,
      status: query.status,
    });

    return {
      items: result.items,
      total: result.total,
      page,
      pageSize,
    };
  }

  // =========================================================================
  // GET /api/users/:id/recent-venues — User recent venues
  // =========================================================================

  async getUserRecentVenues(userId: string) {
    const items = await this.repo.findRecentVenuesForUser(userId, 3);
    return { items };
  }

  // =========================================================================
  // Cross-module service methods
  // =========================================================================

  async getActivityById(id: string) {
    const activity = await this.repo.findById(id);
    if (!activity) return null;

    return {
      id: activity.id,
      creatorId: activity.creatorId,
      venueId: activity.venueId,
      startTime: activity.startTime,
      endTime: activity.endTime,
      status: activity.status,
    };
  }

  async getParticipantIds(activityId: string): Promise<string[]> {
    return this.repo.getParticipantIds(activityId);
  }

  // =========================================================================
  // Scheduled tasks
  // =========================================================================

  async transitionStatuses(): Promise<void> {
    const now = new Date();
    const statusLogger = createModuleLogger('activity-status');

    try {
      // 1. open/full → in_progress (startTime <= now)
      const toInProgress = await this.repo.findActivitiesToTransition(
        ['open', 'full'],
        'startTime',
        now,
      );

      if (toInProgress.length > 0) {
        const ids = toInProgress.map((a) => a.id);
        await this.repo.updateStatus(ids, 'in_progress');
      }

      // 2. in_progress → completed (endTime <= now)
      const toCompleted = await this.repo.findActivitiesToTransition(
        ['in_progress'],
        'endTime',
        now,
      );

      if (toCompleted.length > 0) {
        const ids = toCompleted.map((a) => a.id);
        await this.repo.updateStatus(ids, 'completed');
      }

      statusLogger.info(
        {
          module: 'activity-status',
          toInProgress: toInProgress.length,
          toCompleted: toCompleted.length,
        },
        `状态变更完成：${toInProgress.length} 个活动开始，${toCompleted.length} 个活动结束`,
      );

      if (toInProgress.length > 0) {
        statusLogger.debug(
          { module: 'activity-status', ids: toInProgress.map((a) => a.id) },
          '开始的活动 IDs',
        );
      }
      if (toCompleted.length > 0) {
        statusLogger.debug(
          { module: 'activity-status', ids: toCompleted.map((a) => a.id) },
          '结束的活动 IDs',
        );
      }
    } catch (err) {
      statusLogger.error(
        { module: 'activity-status', error: (err as Error).message },
        '活动状态自动流转失败',
      );
    }
  }

  /**
   * Register cron tasks for activity status transitions.
   * Design doc §6.2: every minute status transition via infra/scheduler.
   */
  registerScheduledTasks(): void {
    registerTask('activity-status-transition', '* * * * *', async () => {
      await this.transitionStatuses();
    });
  }
}
