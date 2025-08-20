import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getLiveStreams } from '../services/streamService';
import type { Stream } from '../types/stream';

export default function LiveWatch() {
  const [streams, setStreams] = useState<Stream[]>([]);

  useEffect(() => {
    let mounted = true;
    getLiveStreams().then((s) => {
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
          <Link key={s.id} to={`/live/watch/${s.id}`} className="p-3 rounded bg-[var(--panel)]">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{s.title || 'Untitled stream'}</div>
                <div className="text-sm text-[var(--muted)]">{s.viewerCount ?? 0} viewers</div>
              </div>
              <div className="text-sm text-[var(--muted)]">Watch</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
