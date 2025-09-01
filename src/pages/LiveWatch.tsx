import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getLiveOnlyStreams, type LiveStreamDoc } from '../services/streamService';

export default function LiveWatch() {
  const [streams, setStreams] = useState<LiveStreamDoc[]>([]);

  useEffect(() => {
    let mounted = true;
  getLiveOnlyStreams().then((s) => {
      if (mounted) setStreams(s || []);
    }).catch(() => {
      if (mounted) setStreams([]);
    });
    return () => { mounted = false; };
  }, []);

  return (
    <div className="pt-12 max-w-3xl mx-auto p-4">
      <h2 className="text-2xl font-semibold">Live streams</h2>
      <div className="mt-4 grid gap-3">
        {streams.length === 0 && <div className="text-[var(--muted)]">No active streams right now.</div>}
        {streams.map(s => (
          <Link key={s.id} to={`/watch/${s.id}`} className="p-3 rounded bg-[var(--panel)]">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{s.title || 'Untitled stream'}</div>
                <div className="text-sm text-[var(--muted)]">by {s.displayName || 'Unknown'}</div>
              </div>
              <span className="ml-auto text-xs px-2 py-1 rounded bg-red-600 text-white">LIVE</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
