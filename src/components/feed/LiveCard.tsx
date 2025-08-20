import React from 'react';
import '../../styles/components/LiveCard.css';
import type { Live } from '../../types/live';
import LiveMeta from './LiveMeta';
import LiveActions from './LiveActions';

export default function LiveCard({ live }: { live: Live }) {
  return (
    <article className="relative w-full h-full">
      {live.thumbnail ? (
        <img src={live.thumbnail} alt={live.title} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-6xl text-white/30">🎬</div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-[var(--primary)]/40 to-transparent" />

      {/* Meta and actions overlay */}
      <div className="absolute left-4 bottom-6 z-10">
        <LiveMeta live={live} />
      </div>

      <div className="absolute right-4 bottom-20 z-10 hidden md:flex flex-col items-center gap-4">
        <LiveActions liveId={live.id} />
      </div>

      {/* Mobile overlay actions (small) */}
      <div className="absolute right-4 bottom-6 z-10 md:hidden">
        <LiveActions liveId={live.id} compact />
      </div>
    </article>
  );
}
