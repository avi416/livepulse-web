import { Link } from 'react-router-dom';
import { useLiveStreams } from '../hooks/useLiveStreams';

export default function Home() {
  const { streams, loading, error } = useLiveStreams();

  return (
    <div className="pt-12 max-w-3xl mx-auto p-4">
      <h2 className="text-xl font-semibold mb-4">Live Now</h2>
      {loading && (
        <div className="text-sm text-[var(--muted)]">Loading…</div>
      )}
      {!loading && error && (
        <div className="text-sm text-red-400">{error}</div>
      )}
      {!loading && !error && streams.length === 0 && (
        <div className="text-sm text-[var(--muted)]">No one is live right now.</div>
      )}
      {!loading && !error && streams.length > 0 && (
        <div className="grid gap-3">
          {streams.filter(s => s.isLive).map((s) => (
            <Link key={s.id} to={`/watch/${s.id}`} className="flex items-center gap-3 p-3 rounded-md bg-[var(--panel)] hover:bg-[var(--panel)]/70 transition-colors">
              {s.thumbnail ? (
                <img src={s.thumbnail} alt={s.streamer} className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white">
                  {(s.streamer || 'U')[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-white font-medium truncate">{s.streamer}</div>
                <div className="text-sm text-[var(--muted)] truncate">{s.title}</div>
              </div>
              <span className="ml-auto text-xs px-2 py-1 rounded bg-red-600 text-white">LIVE</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
