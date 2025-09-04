import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribeToLiveStreams, type LiveStreamDoc } from '../services/liveStreams';
import VerticalFeed from '../components/feed/VerticalFeed';
import VideoPlayer from '../components/VideoPlayer';
import CommentsPanel from '../components/CommentsPanel';
import UserAvatar from '../components/UserAvatar';
import { Heart, MessageCircle, Share2 } from 'lucide-react';
import '../styles/pages/Home.css';
import '../styles/tiktok.css';

type FeedItem = LiveStreamDoc & {
  likes?: number;
  comments?: number;
  isLiked?: boolean;
  streamUrl?: string | null; // Stream URL for the live feed
};

export default function Home() {
  const [liveStreams, setLiveStreams] = useState<FeedItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const navigate = useNavigate();

  // Create a function to generate demo streams
  const generateDemoStreams = (): FeedItem[] => {
    return [
      {
        id: 'demo-stream-1',
        title: 'Live Coding Session',
        displayName: 'CodeMaster',
        photoURL: 'https://placehold.co/600x800/111/FFF?text=Live+Coding',
        status: 'live' as const,
        streamUrl: null,
        startedAt: { toMillis: () => Date.now() } as any,
        likes: 931,
        comments: 68,
        isLiked: false
      } as unknown as FeedItem,
      {
        id: 'demo-stream-2',
        title: 'Gaming Stream',
        displayName: 'GamePro',
        photoURL: 'https://placehold.co/600x800/001/FFF?text=Gaming',
        status: 'live' as const,
        streamUrl: null,
        startedAt: { toMillis: () => Date.now() } as any,
        likes: 452,
        comments: 32,
        isLiked: false
      } as unknown as FeedItem,
      {
        id: 'demo-stream-3',
        title: 'Music Session',
        displayName: 'MusicLover',
        photoURL: 'https://placehold.co/600x800/100/FFF?text=Music',
        status: 'live' as const,
        streamUrl: null,
        startedAt: { toMillis: () => Date.now() } as any,
        likes: 1254,
        comments: 89,
        isLiked: false
      } as unknown as FeedItem
    ];
  };

  // Subscribe to live streams
  useEffect(() => {
    const unsub = subscribeToLiveStreams((streams) => {
      // Process real streams if available
      if (streams.length > 0) {
        const enhancedStreams = streams.map(stream => {
          // Generate a fallback thumbnail if none exists
          const fallbackImage = stream.photoURL || 
            `https://placehold.co/600x800/000000/FFFFFF?text=${encodeURIComponent(stream.displayName || 'Live')}`;
          
          return {
            ...stream,
            streamUrl: null,  // In production, this would be the actual stream URL
            photoURL: stream.photoURL || fallbackImage,
            likes: Math.floor(Math.random() * 1000) + 50,
            comments: Math.floor(Math.random() * 200) + 10,
            isLiked: false
          };
        });
        setLiveStreams(enhancedStreams);
      } else {
        // Use demo streams when no real streams are available
        setLiveStreams(generateDemoStreams());
      }
    });
    
    return () => unsub();
  }, []);

  // Handle like toggle
  const handleLike = useCallback((index: number) => {
    setLiveStreams(prev =>
      prev.map((stream, i) => {
        if (i === index) {
          const newLikedState = !stream.isLiked;
          return {
            ...stream,
            isLiked: newLikedState,
            likes: newLikedState
              ? (stream.likes || 0) + 1
              : Math.max(0, (stream.likes || 0) - 1)
          };
        }
        return stream;
      })
    );
  }, []);

  // Open comments panel
  const handleOpenComments = useCallback(() => {
    setShowComments(true);
  }, []);

  // Navigate to watch page
  const handleWatchStream = useCallback((streamId: string) => {
    navigate(`/watch/${streamId}`);
  }, [navigate]);

  // Handle feed index change
  const handleIndexChange = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  return (
    <div className="page-home">
      {liveStreams.length === 0 ? (
        <div className="feed__empty">
          <h2>No one is live right now</h2>
          <p>Go live yourself or check back later!</p>
        </div>
      ) : (
        <VerticalFeed
          onIndexChange={handleIndexChange}
          initialIndex={0}
        >
          {liveStreams.map((stream, index) => (
            <div key={stream.id} className="feed-item">
              <div className="feed-item__video-container">
                {/* Show placeholder with thumbnail when no stream URL is available */}
                {!stream.streamUrl ? (
                  <div 
                    className="feed-item__placeholder"
                    onClick={() => handleWatchStream(stream.id)}
                  >
                    {stream.photoURL ? (
                      <img 
                        src={stream.photoURL} 
                        alt={stream.title || "Live Stream"} 
                        className="feed-item__placeholder-image" 
                      />
                    ) : (
                      <div className="feed-item__placeholder-fallback">🎬</div>
                    )}
                  </div>
                ) : (
                  <VideoPlayer
                    src={stream.streamUrl}
                    poster={stream.photoURL || undefined}
                    autoPlay={index === currentIndex}
                    onDoubleTap={() => handleLike(index)}
                  />
                )}

                {/* Overlay with stream info */}
                <div className="feed-item__overlay">
                  <div className="feed-item__user-info">
                    <UserAvatar
                      photoURL={stream.photoURL || undefined}
                      displayName={stream.displayName || "User"}
                      size={48}
                      className="feed-item__avatar"
                    />
                    <div>
                      <h3 className="feed-item__username">{stream.displayName || "User"}</h3>
                      <p className="feed-item__title">{stream.title || "Live Stream"}</p>
                    </div>
                  </div>

                  {/* Live badge */}
                  <div className="feed-item__live-badge">LIVE</div>

                  {/* Interaction buttons */}
                  <div className="feed-item__actions">
                    <button
                      className={`feed-item__action-button ${stream.isLiked ? 'feed-item__action-button--active' : ''}`}
                      onClick={() => handleLike(index)}
                      aria-label="Like stream"
                    >
                      <Heart
                        fill={stream.isLiked ? 'currentColor' : 'none'}
                        size={28}
                      />
                      <span>{stream.likes}</span>
                    </button>

                    <button
                      className="feed-item__action-button"
                      onClick={handleOpenComments}
                      aria-label="View comments"
                    >
                      <MessageCircle size={28} />
                      <span>{stream.comments}</span>
                    </button>

                    <button
                      className="feed-item__action-button"
                      aria-label="Share stream"
                    >
                      <Share2 size={28} />
                    </button>
                  </div>

                  {/* Watch stream button */}
                  <button
                    className="feed-item__watch-button"
                    onClick={() => handleWatchStream(stream.id)}
                  >
                    Watch Stream
                  </button>
                </div>
              </div>
            </div>
          ))}
        </VerticalFeed>
      )}

      {/* Comments panel */}
      <CommentsPanel
        isOpen={showComments}
        onClose={() => setShowComments(false)}
        contentId={liveStreams[currentIndex]?.id || ''}
      />
    </div>
  );
}
