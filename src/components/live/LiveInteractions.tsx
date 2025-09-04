import { Heart, MessageSquare, Share, Bookmark } from 'lucide-react';
import { useState } from 'react';
import '../../styles/components/LiveInteractions.css';

interface LiveInteractionsProps {
    initialLikes?: number;
    initialComments?: number;
    onLike?: () => void;
    onComment?: () => void;
    onShare?: () => void;
    onBookmark?: () => void;
    vertical?: boolean;
    className?: string;
}

export default function LiveInteractions({
    initialLikes = 0,
    initialComments = 0,
    onLike,
    onComment,
    onShare,
    onBookmark,
    vertical = true,
    className = ''
}: LiveInteractionsProps) {
    const [liked, setLiked] = useState(false);
    const [likes, setLikes] = useState(initialLikes);
    const [bookmarked, setBookmarked] = useState(false);

    const handleLike = () => {
        const newLikedState = !liked;
        setLiked(newLikedState);
        setLikes(prev => newLikedState ? prev + 1 : prev - 1);
        if (onLike) onLike();
    };

    const handleBookmark = () => {
        setBookmarked(!bookmarked);
        if (onBookmark) onBookmark();
    };

    const handleComment = () => {
        if (onComment) onComment();
    };

    const handleShare = () => {
        if (onShare) onShare();
    };

    return (
        <div className={`live-interactions ${vertical ? 'live-interactions--vertical' : ''} ${className}`}>
            <h3 className="live-interactions__title">Interactions</h3>

            <div className="live-interactions__buttons">
                <button
                    className={`interaction-button ${liked ? 'interaction-button--active' : ''}`}
                    onClick={handleLike}
                    aria-label={`${liked ? 'Unlike' : 'Like'}, ${likes} likes`}
                    aria-pressed={liked}
                    type="button"
                >
                    <Heart className={`interaction-button__icon ${liked ? 'interaction-button__icon--liked' : ''}`} />
                    <span className="interaction-button__count">{likes}</span>
                </button>

                <button
                    className="interaction-button"
                    onClick={handleComment}
                    aria-label={`Comment, ${initialComments} comments`}
                    disabled={!onComment}
                    type="button"
                >
                    <MessageSquare className="interaction-button__icon" />
                    <span className="interaction-button__count">{initialComments}</span>
                </button>

                <button
                    className="interaction-button"
                    onClick={handleShare}
                    aria-label="Share"
                    disabled={!onShare}
                    type="button"
                >
                    <Share className="interaction-button__icon" />
                </button>

                <button
                    className={`interaction-button ${bookmarked ? 'interaction-button--active' : ''}`}
                    onClick={handleBookmark}
                    aria-label={`${bookmarked ? 'Remove bookmark' : 'Bookmark'}`}
                    aria-pressed={bookmarked}
                    type="button"
                >
                    <Bookmark className="interaction-button__icon" />
                </button>
            </div>
        </div>
    );
}
