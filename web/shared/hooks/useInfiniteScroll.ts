import { useEffect, useRef, useCallback } from 'react';

interface UseInfiniteScrollOptions {
  /** Whether there is a next page to load */
  hasNextPage: boolean | undefined;
  /** Whether the next page is currently being fetched */
  isFetchingNextPage: boolean;
  /** Function to fetch the next page */
  fetchNextPage: () => void;
  /** Root margin for IntersectionObserver (default: '200px') */
  rootMargin?: string;
}

/**
 * Hook for infinite scroll loading.
 * Returns a ref callback to attach to a sentinel element at the bottom of the list.
 * When the sentinel enters the viewport, fetchNextPage is called automatically.
 */
export function useInfiniteScroll({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  rootMargin = '200px',
}: UseInfiniteScrollOptions) {
  const observerRef = useRef<IntersectionObserver | null>(null);

  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      if (!node) return;

      // IntersectionObserver may not be available in test environments (jsdom)
      if (typeof IntersectionObserver === 'undefined') return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        },
        { rootMargin },
      );

      observerRef.current.observe(node);
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage, rootMargin],
  );

  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return { sentinelRef };
}
