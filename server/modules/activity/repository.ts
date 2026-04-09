import { Prisma } from '@prisma/client';
import { prisma } from '../../infra/database.js';
import type { ActivityStatus } from './types.js';

export interface CreateActivityData {
  creatorId: string;
  venueId: string;
  title: string | null;
  startTime: Date;
  endTime: Date;
  maxParticipants: number;
}

export interface FindListParams {
  page: number;
  pageSize: number;
  dateFilter?: 'today' | 'tomorrow' | 'this_week';
  dateStart?: string;
  dateEnd?: string;
  maxDistance?: number;
  latitude?: number;
  longitude?: number;
  hasSlot?: boolean;
  sortBy: 'time' | 'distance';
}

export interface FindUserActivitiesParams {
  page: number;
  pageSize: number;
  role?: 'creator' | 'participant';
  status?: ActivityStatus;
}

export interface UpdateActivityData {
  venueId?: string;
  title?: string;
  startTime?: Date;
  endTime?: Date;
  maxParticipants?: number;
  status?: string;
}

export class ActivityRepository {
  /**
   * Create an activity with the creator as the first participant (in a transaction).
   */
  async create(data: CreateActivityData) {
    return prisma.$transaction(async (tx) => {
      const activity = await tx.activity.create({
        data: {
          creatorId: data.creatorId,
          venueId: data.venueId,
          title: data.title,
          startTime: data.startTime,
          endTime: data.endTime,
          maxParticipants: data.maxParticipants,
          status: 'open',
        },
      });

      // Creator auto-joins as first participant
      await tx.activityParticipant.create({
        data: {
          activityId: activity.id,
          userId: data.creatorId,
        },
      });

      // Return with participant count and participants list
      const result = await tx.activity.findUniqueOrThrow({
        where: { id: activity.id },
        include: {
          participants: {
            orderBy: { joinedAt: 'asc' },
          },
          _count: {
            select: { participants: true },
          },
        },
      });

      return {
        ...result,
        currentParticipants: result._count.participants,
      };
    });
  }

  /**
   * Find activity by ID with participants list.
   */
  async findById(id: string) {
    const activity = await prisma.activity.findUnique({
      where: { id },
      include: {
        participants: {
          orderBy: { joinedAt: 'asc' },
        },
        _count: {
          select: { participants: true },
        },
      },
    });

    if (!activity) return null;

    return {
      ...activity,
      currentParticipants: activity._count.participants,
    };
  }

  /**
   * Find activity list with filtering, sorting, and pagination.
   * When coordinates are provided, computes Haversine distance.
   */
  async findList(params: FindListParams) {
    const { page, pageSize, latitude, longitude, hasSlot, dateFilter, dateStart, dateEnd } = params;
    const skip = (page - 1) * pageSize;
    const now = new Date();

    // Build date filter conditions
    let dateConditions: { startTime?: object } = {};
    if (dateFilter) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (dateFilter === 'today') {
        const endOfToday = new Date(today);
        endOfToday.setHours(23, 59, 59, 999);
        dateConditions = {
          startTime: { gte: today, lte: endOfToday },
        };
      } else if (dateFilter === 'tomorrow') {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const endOfTomorrow = new Date(tomorrow);
        endOfTomorrow.setHours(23, 59, 59, 999);
        dateConditions = {
          startTime: { gte: tomorrow, lte: endOfTomorrow },
        };
      } else if (dateFilter === 'this_week') {
        const dayOfWeek = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        dateConditions = {
          startTime: { gte: monday, lte: sunday },
        };
      }
    } else if (dateStart && dateEnd) {
      dateConditions = {
        startTime: { gte: new Date(dateStart), lte: new Date(dateEnd) },
      };
    }

    // Use raw SQL when coordinates are provided (for distance calculation)
    if (latitude !== undefined && longitude !== undefined) {
      return this.findListWithDistance(params, skip, now, dateConditions);
    }

    // Standard Prisma query without distance
    // Use endTime > now so in-progress activities stay visible;
    // when a date filter is active, use startTime for that range instead.
    const where: Prisma.ActivityWhereInput = {
      status: hasSlot ? 'open' : { not: 'cancelled' },
      ...(dateConditions.startTime
        ? { startTime: dateConditions.startTime }
        : { endTime: { gt: now } }),
    };

    const [items, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        include: {
          venue: {
            select: { id: true, name: true, address: true, latitude: true, longitude: true },
          },
          _count: { select: { participants: true } },
        },
        orderBy: { startTime: 'asc' },
        skip,
        take: pageSize,
      }),
      prisma.activity.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        creatorId: item.creatorId,
        venue: item.venue,
        title: item.title,
        startTime: item.startTime,
        endTime: item.endTime,
        maxParticipants: item.maxParticipants,
        currentParticipants: item._count.participants,
        status: item.status,
        createdAt: item.createdAt,
      })),
      total,
    };
  }

  /**
   * Find activity list with Haversine distance calculation via raw SQL.
   */
  private async findListWithDistance(
    params: FindListParams,
    skip: number,
    now: Date,
    dateConditions: { startTime?: object },
  ) {
    const { page: _page, pageSize, latitude, longitude, maxDistance, hasSlot, sortBy } = params;

    // Build WHERE conditions for raw SQL
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    // Status filter
    if (hasSlot) {
      conditions.push(`a.status = 'open'`);
    } else {
      conditions.push(`a.status != 'cancelled'`);
    }

    // Date filter
    if (dateConditions.startTime) {
      const timeFilter = dateConditions.startTime as { gte?: Date; lte?: Date; gt?: Date };
      if (timeFilter.gte) {
        conditions.push(`a."startTime" >= $${paramIndex}`);
        values.push(timeFilter.gte);
        paramIndex++;
      }
      if (timeFilter.lte) {
        conditions.push(`a."startTime" <= $${paramIndex}`);
        values.push(timeFilter.lte);
        paramIndex++;
      }
      if (timeFilter.gt) {
        conditions.push(`a."startTime" > $${paramIndex}`);
        values.push(timeFilter.gt);
        paramIndex++;
      }
    } else {
      // Show ongoing + future activities (endTime > now)
      conditions.push(`a."endTime" > $${paramIndex}`);
      values.push(now);
      paramIndex++;
    }

    // Distance parameters
    const latParam = paramIndex;
    values.push(latitude);
    paramIndex++;
    const lngParam = paramIndex;
    values.push(longitude);
    paramIndex++;

    // Max distance filter
    let distanceFilter = '';
    if (maxDistance !== undefined) {
      distanceFilter = `HAVING (6371 * 2 * ASIN(SQRT(
        POWER(SIN(RADIANS(v.latitude - $${latParam}) / 2), 2) +
        COS(RADIANS($${latParam})) * COS(RADIANS(v.latitude)) *
        POWER(SIN(RADIANS(v.longitude - $${lngParam}) / 2), 2)
      ))) <= $${paramIndex}`;
      values.push(maxDistance);
      paramIndex++;
    }

    const orderClause = sortBy === 'distance'
      ? 'distance ASC'
      : 'a."startTime" ASC';

    const whereClause = conditions.join(' AND ');

    // Main query
    const sql = `
      SELECT
        a.id,
        a."creatorId",
        a.title,
        a."startTime",
        a."endTime",
        a."maxParticipants",
        a.status,
        a."createdAt",
        v.id as "venueId",
        v.name as "venueName",
        v.address as "venueAddress",
        v.latitude as "venueLatitude",
        v.longitude as "venueLongitude",
        (SELECT COUNT(*) FROM "ActivityParticipant" ap WHERE ap."activityId" = a.id)::int as "currentParticipants",
        ROUND(
          (6371 * 2 * ASIN(SQRT(
            POWER(SIN(RADIANS(v.latitude - $${latParam}) / 2), 2) +
            COS(RADIANS($${latParam})) * COS(RADIANS(v.latitude)) *
            POWER(SIN(RADIANS(v.longitude - $${lngParam}) / 2), 2)
          )))::numeric, 1
        )::float AS distance
      FROM "Activity" a
      LEFT JOIN "Venue" v ON a."venueId" = v.id
      WHERE ${whereClause}
      GROUP BY a.id, v.id
      ${distanceFilter}
      ORDER BY ${orderClause}
      LIMIT ${pageSize} OFFSET ${skip}
    `;

    // Count query
    const countSql = `
      SELECT COUNT(*)::int as total
      FROM (
        SELECT a.id,
          ROUND(
            (6371 * 2 * ASIN(SQRT(
              POWER(SIN(RADIANS(v.latitude - $${latParam}) / 2), 2) +
              COS(RADIANS($${latParam})) * COS(RADIANS(v.latitude)) *
              POWER(SIN(RADIANS(v.longitude - $${lngParam}) / 2), 2)
            )))::numeric, 1
          )::float AS distance
        FROM "Activity" a
        LEFT JOIN "Venue" v ON a."venueId" = v.id
        WHERE ${whereClause}
        GROUP BY a.id, v.id
        ${distanceFilter}
      ) sub
    `;

    const [rows, countResult] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{
        id: string;
        creatorId: string;
        title: string | null;
        startTime: Date;
        endTime: Date;
        maxParticipants: number;
        status: string;
        createdAt: Date;
        venueId: string | null;
        venueName: string | null;
        venueAddress: string | null;
        venueLatitude: number | null;
        venueLongitude: number | null;
        currentParticipants: number;
        distance: number;
      }>>(sql, ...values),
      prisma.$queryRawUnsafe<Array<{ total: number }>>(countSql, ...values),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        creatorId: row.creatorId,
        venue: row.venueId
          ? {
              id: row.venueId,
              name: row.venueName!,
              address: row.venueAddress!,
              latitude: row.venueLatitude!,
              longitude: row.venueLongitude!,
            }
          : null,
        title: row.title,
        startTime: row.startTime,
        endTime: row.endTime,
        maxParticipants: row.maxParticipants,
        currentParticipants: row.currentParticipants,
        status: row.status,
        distance: row.distance,
        createdAt: row.createdAt,
      })),
      total: countResult[0]?.total ?? 0,
    };
  }

  /**
   * Add a participant to an activity (in a transaction).
   * Returns updated participant count and potentially updated status.
   */
  async addParticipant(activityId: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const participant = await tx.activityParticipant.create({
        data: { activityId, userId },
      });

      const count = await tx.activityParticipant.count({
        where: { activityId },
      });

      const activity = await tx.activity.findUniqueOrThrow({
        where: { id: activityId },
      });

      // Check if activity becomes full
      if (count >= activity.maxParticipants && activity.status === 'open') {
        await tx.activity.update({
          where: { id: activityId },
          data: { status: 'full' },
        });
        return { currentParticipants: count, status: 'full' as const, joinedAt: participant.joinedAt };
      }

      return { currentParticipants: count, status: activity.status, joinedAt: participant.joinedAt };
    });
  }

  /**
   * Remove a participant from an activity (in a transaction).
   * Returns updated participant count and potentially updated status.
   */
  async removeParticipant(activityId: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      await tx.activityParticipant.deleteMany({
        where: { activityId, userId },
      });

      const count = await tx.activityParticipant.count({
        where: { activityId },
      });

      const activity = await tx.activity.findUniqueOrThrow({
        where: { id: activityId },
      });

      // Check if activity was full and now has space
      if (activity.status === 'full' && count < activity.maxParticipants) {
        await tx.activity.update({
          where: { id: activityId },
          data: { status: 'open' },
        });
        return { currentParticipants: count, status: 'open' as const };
      }

      return { currentParticipants: count, status: activity.status };
    });
  }

  /**
   * Update activity fields and return the updated record.
   */
  async update(id: string, data: UpdateActivityData) {
    const updateData: Prisma.ActivityUpdateInput = {};
    if (data.venueId !== undefined) updateData.venue = { connect: { id: data.venueId } };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.startTime !== undefined) updateData.startTime = data.startTime;
    if (data.endTime !== undefined) updateData.endTime = data.endTime;
    if (data.maxParticipants !== undefined) updateData.maxParticipants = data.maxParticipants;
    if (data.status !== undefined) updateData.status = data.status;

    const activity = await prisma.activity.update({
      where: { id },
      data: updateData,
      include: {
        venue: {
          select: { id: true, name: true, address: true, latitude: true, longitude: true },
        },
        _count: { select: { participants: true } },
      },
    });

    return {
      id: activity.id,
      creatorId: activity.creatorId,
      venue: activity.venue,
      title: activity.title,
      startTime: activity.startTime,
      endTime: activity.endTime,
      maxParticipants: activity.maxParticipants,
      currentParticipants: activity._count.participants,
      status: activity.status,
      createdAt: activity.createdAt,
    };
  }

  /**
   * Update activity status. Supports single ID or array of IDs (batch).
   */
  async updateStatus(idOrIds: string | string[], status: string) {
    if (Array.isArray(idOrIds)) {
      await prisma.activity.updateMany({
        where: { id: { in: idOrIds } },
        data: { status },
      });
    } else {
      await prisma.activity.update({
        where: { id: idOrIds },
        data: { status },
      });
    }
  }

  /**
   * Find activities belonging to a user (as creator, participant, or both).
   */
  async findUserActivities(userId: string, params: FindUserActivitiesParams) {
    const { page, pageSize, role, status } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ActivityWhereInput = {};

    if (role === 'creator') {
      where.creatorId = userId;
    } else if (role === 'participant') {
      where.participants = { some: { userId } };
      where.creatorId = { not: userId };
    } else {
      // All activities where user is creator OR participant
      where.OR = [
        { creatorId: userId },
        { participants: { some: { userId } } },
      ];
    }

    if (status) {
      where.status = status;
    }

    const [items, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        include: {
          venue: {
            select: { id: true, name: true, address: true, latitude: true, longitude: true },
          },
          _count: { select: { participants: true } },
        },
        orderBy: { startTime: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.activity.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        creatorId: item.creatorId,
        venue: item.venue,
        title: item.title,
        startTime: item.startTime,
        endTime: item.endTime,
        maxParticipants: item.maxParticipants,
        currentParticipants: item._count.participants,
        status: item.status,
        createdAt: item.createdAt,
      })),
      total,
    };
  }

  /**
   * Find recent venues that the user participated in activities at.
   */
  async findRecentVenuesForUser(userId: string, limit: number = 3) {
    const activities = await prisma.activity.findMany({
      where: {
        participants: { some: { userId } },
        venueId: { not: null },
      },
      select: {
        venue: {
          select: { id: true, name: true, address: true, latitude: true, longitude: true },
        },
      },
      orderBy: { startTime: 'desc' },
      take: 50, // fetch enough to distinct
    });

    const seen = new Set<string>();
    const venues = [];

    for (const a of activities) {
      if (a.venue && !seen.has(a.venue.id)) {
        seen.add(a.venue.id);
        venues.push({
          ...a.venue,
          // Add this property to make interface compatibility easier down the line
          latitude: a.venue.latitude ?? undefined,
          longitude: a.venue.longitude ?? undefined,
        });
        if (venues.length >= limit) break;
      }
    }

    return venues;
  }

  /**
   * Find activities to transition status (for scheduled task).
   */
  async findActivitiesToTransition(fromStatuses: string[], timeField: string, now: Date) {
    if (timeField === 'startTime') {
      return prisma.activity.findMany({
        where: {
          status: { in: fromStatuses },
          startTime: { lte: now },
        },
        select: { id: true },
      });
    } else {
      return prisma.activity.findMany({
        where: {
          status: { in: fromStatuses },
          endTime: { lte: now },
        },
        select: { id: true },
      });
    }
  }

  /**
   * Get all participant user IDs for an activity.
   */
  async getParticipantIds(activityId: string): Promise<string[]> {
    const participants = await prisma.activityParticipant.findMany({
      where: { activityId },
      select: { userId: true },
    });
    return participants.map((p) => p.userId);
  }
}
