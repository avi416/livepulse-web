import type { ReactNode } from 'react';
import { Heart, MessageSquare, Share2, Bookmark, Video, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

type ActionProps = { 
  icon: ReactNode; 
  label: string; 
  count?: number;
  onClick?: () => void;
  to?: string;
  highlight?: boolean;
};

function Action({ icon, label, count, onClick, to, highlight }: ActionProps) {
  const className = `w-12 h-12 rounded-full ${highlight ? 'bg-blue-600 text-white' : 'bg-[var(--panel)]'} flex items-center justify-center shadow-md hover:opacity-90 transition-opacity`;
  
  if (to) {
    return (
      <div className="flex flex-col items-center gap-1">
        <Link to={to} aria-label={label} className={className}>
          {icon}
        </Link>
        {typeof count === 'number' && <span className="text-sm text-[var(--muted)]">{count}</span>}
      </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center gap-1">
      <button 
        onClick={onClick} 
        aria-label={label} 
        className={className}
      >
        {icon}
      </button>
      {typeof count === 'number' && <span className="text-sm text-[var(--muted)]">{count}</span>}
    </div>
  );
}

export default function ActionRail() {
  const { user } = useAuth();
  const location = useLocation();
  const isWatchPage = location.pathname.startsWith('/watch/');
  const streamId = isWatchPage ? location.pathname.split('/').pop() : null;
  
  return (
    <div className="p-3 sticky top-40 flex flex-col items-center gap-4">
      <Action icon={<Heart className="w-5 h-5 text-[var(--primary)]" />} label="Like" count={124} />
      <Action icon={<MessageSquare className="w-5 h-5 text-[var(--primary)]" />} label="Comment" count={32} />
      <Action icon={<Share2 className="w-5 h-5 text-[var(--primary)]" />} label="Share" />
      <Action icon={<Bookmark className="w-5 h-5 text-[var(--primary)]" />} label="Save" />
      
      {/* Join as Co-Host button - only show when watching a stream and logged in */}
      {isWatchPage && streamId && user && (
        <div className="mt-4 border-t pt-4 border-gray-700/30">
          <Action 
            icon={<Users className="w-5 h-5" />} 
            label="Join as Co-Host"
            highlight={true}
            to={`/watch/${streamId}`}
          />
          <div className="text-xs text-center mt-1 text-[var(--muted)] max-w-[80px]">
            Join Stream
          </div>
        </div>
      )}
      
      {/* Go Live button - show when not on watch page */}
      {!isWatchPage && user && (
        <div className="mt-4 border-t pt-4 border-gray-700/30">
          <Action 
            icon={<Video className="w-5 h-5" />} 
            label="Go Live"
            highlight={true}
            to="/live/go"
          />
          <div className="text-xs text-center mt-1 text-[var(--muted)] max-w-[80px]">
            Start Live
          </div>
        </div>
      )}
    </div>
  );
}
