import '../../styles/components/LiveMeta.css';
import type { Live } from '../../types/live';

export default function LiveMeta({ live }: { live: Live }) {
  return (
    <div className="video-meta">
      <div className="video-meta__handle">
        <span className="live-badge">LIVE</span>
        <span>@{live.userHandle}</span>
      </div>
      <div className="video-meta__title">{live.title}</div>
      <div className="video-meta__viewers">{live.viewers} viewers</div>
      <div className="video-meta__tags">
        {live.tags.slice(0, 3).map((t: string) => (
          <span key={t} className="video-meta__tag">#{t}</span>
        ))}
      </div>
    </div>
  );
}
