import { useEffect, useState } from 'react';
import type { Stream } from '../types/stream';
import { getLiveStreams } from '../services/streamService';

export function useLiveStreams() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLiveStreams()
      .then(setStreams)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { streams, loading, error };
}
