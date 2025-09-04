import '../../styles/components/LiveActions.css';
import { Heart, MessageCircle, Share } from 'lucide-react';

type Props = { compact?: boolean; liveId?: string };

export default function LiveActions({ compact }: Props) {
  return (
    <div className={`action-buttons ${compact ? 'action-buttons--compact' : ''}`} role="toolbar" aria-label="live actions">
      <div className="action-icon">
        <button className="action-icon__button" aria-label="like">
          <Heart size={24} strokeWidth={2} />
        </button>
        <span className="action-icon__count">12.4k</span>
      </div>

      <div className="action-icon">
        <button className="action-icon__button" aria-label="comment">
          <MessageCircle size={24} strokeWidth={2} />
        </button>
        <span className="action-icon__count">432</span>
      </div>

      <div className="action-icon">
        <button className="action-icon__button" aria-label="share">
          <Share size={24} strokeWidth={2} />
        </button>
        <span className="action-icon__count">Share</span>
      </div>
    </div>
  );
}
