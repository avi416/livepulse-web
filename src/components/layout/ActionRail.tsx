import { useState, type ReactNode } from 'react';
import { Heart, MessageCircle, Share2, Bookmark, Video, Users, Plus } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import UserAvatar from '../UserAvatar';
import '../../styles/components/ActionRail.css';

type ActionProps = {
  icon: ReactNode;
  label: string;
  count?: number;
  onClick?: () => void;
  to?: string;
  highlight?: boolean;
  animated?: boolean;
};

function Action({ icon, label, count, onClick, to, highlight, animated }: ActionProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  const buttonClassName = `action-icon__button ${highlight ? 'action-icon__button--primary' : ''} ${animated && isAnimating ? 'action-icon__button--animated' : ''}`;

  const handleClick = () => {
    if (animated) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 1000);
    }
    if (onClick) onClick();
  };

  if (to) {
    return (
      <div className="action-icon">
        <Link to={to} aria-label={label} className={buttonClassName}>
          {icon}
        </Link>
        {typeof count === 'number' && (
          <span className="action-icon__count">
            {count > 999 ? `${(count / 1000).toFixed(1)}K` : count}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="action-icon">
      <button
        onClick={handleClick}
        aria-label={label}
        className={buttonClassName}
      >
        {icon}
      </button>
      {typeof count === 'number' && (
        <span className="action-icon__count">
          {count > 999 ? `${(count / 1000).toFixed(1)}K` : count}
        </span>
      )}
    </div>
  );
}

export default function ActionRail() {
  const { user } = useAuth();
  const location = useLocation();
  const isWatchPage = location.pathname.startsWith('/watch/');
  const isLivePage = location.pathname.startsWith('/live/watch');
  const streamId = isWatchPage ? location.pathname.split('/').pop() : null;
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(1254);

  // Only show interactions on watch pages
  const shouldShowInteractions = isWatchPage || isLivePage;

  const handleLike = () => {
    setLiked(!liked);
    setLikeCount(prev => liked ? prev - 1 : prev + 1);
  };

  const showComments = () => {
    // Implementation for showing comments panel
    console.log('Show comments panel');
  };

  return (
    <div className="action-rail__container">
      {shouldShowInteractions && (
        <div className="action-rail__section">
          <div className="action-rail__avatar-container">
            <UserAvatar
              photoURL={user?.photoURL || ''}
              displayName={user?.displayName || 'User'}
              size={40}
              className="action-rail__avatar"
            />
            <button className="action-rail__follow-button" aria-label="Follow">
              <Plus size={16} />
            </button>
          </div>

          <div className="action-rail__actions">
            <Action
              icon={<Heart size={28} fill={liked ? 'currentColor' : 'none'} />}
              label="Like"
              count={likeCount}
              onClick={handleLike}
              highlight={liked}
              animated={true}
            />
            <Action
              icon={<MessageCircle size={28} />}
              label="Comments"
              count={244}
              onClick={showComments}
            />
            <Action
              icon={<Bookmark size={28} />}
              label="Save"
              count={96}
            />
            <Action
              icon={<Share2 size={28} />}
              label="Share"
            />
          </div>
        </div>
      )}

      {/* Join as Co-Host button - only show when watching a stream and logged in */}
      {isWatchPage && streamId && user && (
        <div className="action-rail__section">
          <h3 className="action-rail__title">Join Stream</h3>
          <div className="action-rail__list">
            <Action
              icon={<Users size={24} />}
              label="Join as Co-Host"
              highlight={true}
              to={`/watch/${streamId}`}
            />
          </div>
        </div>
      )}

      {/* Go Live button - show when not on watch page */}
      {!isWatchPage && user && (
        <div className="action-rail__section">
          <h3 className="action-rail__title">Create</h3>
          <div className="action-rail__list">
            <Action
              icon={<Video size={24} />}
              label="Go Live"
              highlight={true}
              to="/live/go"
            />
          </div>
        </div>
      )}
    </div>
  );
}
