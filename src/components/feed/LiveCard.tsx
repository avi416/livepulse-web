import '../../styles/components/VideoCard.css';
import type { Live } from '../../types/live';
import LiveMeta from './LiveMeta';
import LiveActions from './LiveActions';

export default function LiveCard({ live }: { live: Live }) {
  return (
    <article className="video-card">
      {live.thumbnail ? (
        <img src={live.thumbnail} alt={live.title} className="video-card__media" />
      ) : (
        <div className="video-card__placeholder">🎬</div>
      )}

      <div className="video-card__gradient" />

      {/* Meta and actions overlay */}
      <div className="video-card__meta">
        <LiveMeta live={live} />
      </div>

      <div className="video-card__actions video-card__actions--desktop">
        <LiveActions liveId={live.id} />
      </div>

      {/* Mobile overlay actions (small) */}
      <div className="video-card__actions video-card__actions--mobile">
        <LiveActions liveId={live.id} compact />
      </div>
    </article>
  );
}
