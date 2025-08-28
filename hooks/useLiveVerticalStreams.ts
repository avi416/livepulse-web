import { useEffect, useMemo, useState } from 'react';
import type { Live } from '../types/live';
import { subscribeToLiveStreams, type LiveStreamDoc } from '../services/liveStreams';

function toHandle(name?: string | null): string {
  const base = (name || 'user').toString();
  return base.trim().toLowerCase().replace(/\s+/g, '');
}

export function useLiveVerticalStreams() {
  const [docs, setDocs] = useState<LiveStreamDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToLiveStreams((items: LiveStreamDoc[]) => {
      setDocs(items);
      setLoading(false);
    });
    return () => { try { unsub(); } catch {} };
  }, []);

  const items: Live[] = useMemo(() => {
    return docs
      .filter((d) => (d as any).status === 'live')
      .map((d) => ({
        id: d.id,
        userHandle: toHandle((d as any).displayName || ''),
        userName: (d as any).displayName || '',
        title: d.title,
        viewers: 0,
        tags: [],
        thumbnail: (d as any).photoURL || undefined,
        isLive: true,
        startedAt: undefined,
        isFollowed: false,
      }));
  }, [docs]);

  return { items, loading };
}
