import { useEffect, useState } from 'react';
import type { Stream } from '../types/stream';
import { subscribeLiveStreams, type LiveStreamDoc } from '../services/streamService';

export function useLiveStreams() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Subscribe to real-time updates for live streams
    const unsubscribe = subscribeLiveStreams((items: LiveStreamDoc[]) => {
      try {
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
        setLoading(false);
      } catch (e: any) {
        setError(e.message);
        setLoading(false);
      }
    });

    // Clean up subscription when component unmounts
    return () => {
      unsubscribe();
    };
  }, []);

  return { streams, loading, error };
}
