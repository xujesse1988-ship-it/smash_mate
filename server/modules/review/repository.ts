import { prisma } from '../../infra/database.js';
import type { CourseType } from './types.js';

export interface CreateReviewData {
  reviewerId: string;
  coachId: string;
  courseType: CourseType;
  courseId: string;
  rating: number;
  comment?: string | null;
}

export class ReviewRepository {
  async create(data: CreateReviewData) {
    return prisma.review.create({
      data: {
        reviewerId: data.reviewerId,
        coachId: data.coachId,
        courseType: data.courseType,
        courseId: data.courseId,
        rating: data.rating,
        comment: data.comment ?? null,
      },
    });
  }

  async findByCoach(coachId: string, query: { page: number; pageSize: number }) {
    const skip = (query.page - 1) * query.pageSize;
    const take = query.pageSize;

    const [items, total] = await Promise.all([
      prisma.review.findMany({
        where: { coachId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.review.count({ where: { coachId } }),
    ]);

    return { items, total };
  }

  async findDuplicate(reviewerId: string, courseType: string, courseId: string) {
    return prisma.review.findUnique({
      where: {
        reviewerId_courseType_courseId: {
          reviewerId,
          courseType,
          courseId,
        },
      },
    });
  }

  async getCoachAverageRating(coachId: string) {
    const result = await prisma.review.aggregate({
      where: { coachId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const totalCount = result._count.rating;
    const avg = result._avg.rating;

    return {
      averageRating: totalCount > 0 && avg !== null ? Math.round(avg * 10) / 10 : null,
      totalCount,
    };
  }

  async getCoachesAverageRatings(coachIds: string[]) {
    if (coachIds.length === 0) return [];

    const results = await prisma.review.groupBy({
      by: ['coachId'],
      where: { coachId: { in: coachIds } },
      _avg: { rating: true },
      _count: { rating: true },
    });

    return results.map((r) => ({
      coachId: r.coachId,
      averageRating:
        r._count.rating > 0 && r._avg.rating !== null ? Math.round(r._avg.rating * 10) / 10 : null,
      totalCount: r._count.rating,
    }));
  }
}
