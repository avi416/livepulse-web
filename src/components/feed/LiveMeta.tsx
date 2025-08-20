// React default import not required with react-jsx
import '../../styles/components/LiveMeta.css';
import type { Live } from '../../types/live';

export default function LiveMeta({ live }: { live: Live }) {
  return (
    <div className="meta">
      <div className="handle">@{live.userHandle} · {live.viewers} viewers</div>
      <div className="title">{live.title}</div>
      <div className="tags">
        {live.tags.slice(0,3).map((t: string) => (
          <span key={t} className="tag">#{t}</span>
        ))}
      </div>
    </div>
  );
}
