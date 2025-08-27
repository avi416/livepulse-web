import { useEffect, useState } from 'react';
import type { Stream } from '../types/stream';
import { getLiveOnlyStreams, type LiveStreamDoc } from '../services/streamService';

export function useLiveStreams() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLiveOnlyStreams()
      .then((items: LiveStreamDoc[]) => {
        // Map Firestore live docs to demo Stream type for this component
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
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { streams, loading, error };
}
