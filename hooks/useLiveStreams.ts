import { useEffect, useState } from 'react';
import type { Stream } from '../types/stream';
import { subscribeToLiveStreams, type LiveStreamDoc } from '../services/liveStreams';

export function useLiveStreams() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const unsub = subscribeToLiveStreams((items: LiveStreamDoc[]) => {
      const mapped: Stream[] = items.map((d) => ({
        id: d.id,
        title: d.title,
        streamer: d.displayName || 'Unknown',
        videoUrl: '',
        viewers: 0,
        isLive: d.status === 'live',
        thumbnail: d.photoURL || ''
      }));
      setStreams(mapped);
      setLoading(false);
    });
    return () => { try { unsub(); } catch {} };
  }, []);

  return { streams, loading, error };
}
