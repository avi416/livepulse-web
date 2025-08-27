import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { subscribeToLiveStreams, type LiveStreamDoc } from '../services/liveStreams';

export default function Home() {
  const [liveStreams, setLiveStreams] = useState<LiveStreamDoc[]>([]);

  useEffect(() => {
    const unsub = subscribeToLiveStreams(setLiveStreams);
    return () => unsub();
  }, []);

  return (
    <div className="pt-12 max-w-3xl mx-auto p-4">
      <h2 className="text-xl font-semibold mb-4">Live Now</h2>
      {liveStreams.length === 0 ? (
        <div className="text-sm text-[var(--muted)]">No one is live right now.</div>
      ) : (
        <div className="grid gap-3">
          {liveStreams.map((l) => (
            <Link key={l.id} to={`/watch/${l.id}`} className="flex items-center gap-3 p-3 rounded-md bg-[var(--panel)] hover:bg-[var(--panel)]/70 transition-colors">
              {l.photoURL ? (
                <img src={l.photoURL} alt={l.displayName} className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white">
                  {(l.displayName || 'U')[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-white font-medium truncate">{l.displayName}</div>
                <div className="text-sm text-[var(--muted)] truncate">{l.title}</div>
              </div>
              <span className="ml-auto text-xs px-2 py-1 rounded bg-red-600 text-white">LIVE</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
