import { useCallback, useMemo, useState } from 'react';
import type { Live } from '../types/live';
import { generateMockLives } from '../services/api';

export function useInfiniteLives(pageSize = 5) {
  const [page, setPage] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const items: Live[] = useMemo(() => {
    // generate pages 0..page
    return Array.from({ length: page + 1 }).flatMap((_, p) => generateMockLives(p, pageSize));
  }, [page, pageSize]);

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    setLoading(true);
    // simulate async
    setTimeout(() => {
      setPage((s) => s + 1);
  // for demo limit to 10 pages
  setHasMore(( ) => (page + 1) < 10);
      setLoading(false);
    }, 400);
  }, [loading, hasMore, page]);

  return { items, loadMore, hasMore, loading };
}
