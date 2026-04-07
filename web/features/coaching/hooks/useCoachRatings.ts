import { useEffect, useState, useCallback } from 'react';
import { getCoachesRatings, type CoachRating } from '../api/review-api';
import type { CoachListItem } from '../api/coaching-api';

interface MergedCoach extends CoachListItem {
  averageRating: number | null;
  totalCount: number;
}

interface UseCoachRatingsReturn {
  mergedCoaches: MergedCoach[];
  isRatingsLoading: boolean;
}

export function useCoachRatings(
  coaches: CoachListItem[],
  enabled: boolean = true,
): UseCoachRatingsReturn {
  const [mergedCoaches, setMergedCoaches] = useState<MergedCoach[]>([]);
  const [isRatingsLoading, setIsRatingsLoading] = useState(false);

  const fetchRatings = useCallback(async () => {
    if (!coaches.length || !enabled) {
      setMergedCoaches(
        coaches.map((c) => ({ ...c, averageRating: null, totalCount: 0 })),
      );
      return;
    }

    setIsRatingsLoading(true);
    try {
      const coachIds = coaches.map((c) => c.userId);
      const result = await getCoachesRatings(coachIds);

      const ratingsMap = new Map<string, CoachRating>();
      for (const r of result.ratings) {
        ratingsMap.set(r.coachId, r);
      }

      const merged = coaches.map((coach) => {
        const rating = ratingsMap.get(coach.userId);
        return {
          ...coach,
          averageRating: rating?.averageRating ?? null,
          totalCount: rating?.totalCount ?? 0,
        };
      });

      // Sort by averageRating descending, null last
      merged.sort((a, b) => {
        if (a.averageRating === null && b.averageRating === null) return 0;
        if (a.averageRating === null) return 1;
        if (b.averageRating === null) return -1;
        return b.averageRating - a.averageRating;
      });

      setMergedCoaches(merged);
    } catch {
      // Silent failure: show coaches without ratings
      setMergedCoaches(
        coaches.map((c) => ({ ...c, averageRating: null, totalCount: 0 })),
      );
    } finally {
      setIsRatingsLoading(false);
    }
  }, [coaches, enabled]);

  useEffect(() => {
    fetchRatings();
  }, [fetchRatings]);

  return { mergedCoaches, isRatingsLoading };
}
