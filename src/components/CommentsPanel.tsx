import { useState, useRef, useEffect } from 'react';
import { X, Smile, Send, Heart } from 'lucide-react';
import UserAvatar from './UserAvatar';
import '../styles/components/CommentsPanel.css';

interface Comment {
    id: string;
    userId: string;
    username: string;
    photoURL?: string;
    text: string;
    timestamp: number;
    likes: number;
    isLiked?: boolean;
}

interface CommentsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    contentId: string;
    initialComments?: Comment[];
    onAddComment?: (text: string) => Promise<void>;
    onLikeComment?: (commentId: string, liked: boolean) => Promise<void>;
}

export default function CommentsPanel({
    isOpen,
    onClose,
    // contentId is not used in the component
    initialComments = [],
    onAddComment,
    onLikeComment
}: CommentsPanelProps) {
    const [comments, setComments] = useState<Comment[]>(initialComments);
    const [newComment, setNewComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const commentInputRef = useRef<HTMLInputElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    // Focus input when panel opens
    useEffect(() => {
        if (isOpen && commentInputRef.current) {
            setTimeout(() => {
                commentInputRef.current?.focus();
            }, 300);
        }
    }, [isOpen]);

    // Handle click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    // Prevent scrolling on body when panel is open
    useEffect(() => {
        const originalStyle = window.getComputedStyle(document.body).overflow;

        if (isOpen) {
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.body.style.overflow = originalStyle;
        };
    }, [isOpen]);

    // Mock data for demo purposes
    useEffect(() => {
        if (initialComments.length === 0) {
            setComments([
                {
                    id: '1',
                    userId: 'user1',
                    username: 'alex_chen',
                    photoURL: 'https://i.pravatar.cc/150?img=1',
                    text: 'This stream is awesome! 🔥',
                    timestamp: Date.now() - 1000 * 60 * 5, // 5 minutes ago
                    likes: 42,
                    isLiked: false
                },
                {
                    id: '2',
                    userId: 'user2',
                    username: 'emma_j',
                    photoURL: 'https://i.pravatar.cc/150?img=5',
                    text: 'How did you set up this lighting? It looks so professional!',
                    timestamp: Date.now() - 1000 * 60 * 10, // 10 minutes ago
                    likes: 24,
                    isLiked: true
                },
                {
                    id: '3',
                    userId: 'user3',
                    username: 'taylor_swift_fan',
                    photoURL: 'https://i.pravatar.cc/150?img=9',
                    text: 'Can you play the song you mentioned earlier?',
                    timestamp: Date.now() - 1000 * 60 * 15, // 15 minutes ago
                    likes: 18,
                    isLiked: false
                }
            ]);
        }
    }, [initialComments]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!newComment.trim() || isSubmitting) return;

        setIsSubmitting(true);

        try {
            // Add comment locally first for immediate feedback
            const tempComment: Comment = {
                id: `temp-${Date.now()}`,
                userId: 'current-user',
                username: 'You',
                text: newComment,
                timestamp: Date.now(),
                likes: 0
            };

            setComments(prev => [tempComment, ...prev]);
            setNewComment('');

            // Call API if provided
            if (onAddComment) {
                await onAddComment(newComment);
            }
        } catch (error) {
            console.error('Error adding comment:', error);
            // Optionally remove the temp comment on error
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleLikeComment = async (commentId: string) => {
        setComments(prev =>
            prev.map(comment => {
                if (comment.id === commentId) {
                    const isLiked = !comment.isLiked;
                    return {
                        ...comment,
                        isLiked,
                        likes: isLiked ? comment.likes + 1 : comment.likes - 1
                    };
                }
                return comment;
            })
        );

        if (onLikeComment) {
            const comment = comments.find(c => c.id === commentId);
            if (comment) {
                await onLikeComment(commentId, !comment.isLiked);
            }
        }
    };

    const formatTimestamp = (timestamp: number) => {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);

        if (seconds < 60) return `${seconds}s`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
        return `${Math.floor(seconds / 86400)}d`;
    };

    return (
        <div className={`comments-panel-container ${isOpen ? 'comments-panel-container--open' : ''}`}>
            <div
                className={`comments-panel ${isOpen ? 'comments-panel--open' : ''}`}
                ref={panelRef}
            >
                <div className="comments-panel__header">
                    <h3 className="comments-panel__title">{comments.length} comments</h3>
                    <button
                        className="comments-panel__close-button"
                        onClick={onClose}
                        aria-label="Close comments"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="comments-panel__content">
                    {comments.map(comment => (
                        <div key={comment.id} className="comment-item">
                            <div className="comment-item__avatar">
                                <UserAvatar
                                    photoURL={comment.photoURL}
                                    displayName={comment.username}
                                    size={32}
                                />
                            </div>

                            <div className="comment-item__content">
                                <div className="comment-item__header">
                                    <span className="comment-item__username">{comment.username}</span>
                                    <span className="comment-item__time">{formatTimestamp(comment.timestamp)}</span>
                                </div>

                                <p className="comment-item__text">{comment.text}</p>
                            </div>

                            <button
                                className={`comment-item__like-button ${comment.isLiked ? 'comment-item__like-button--liked' : ''}`}
                                onClick={() => handleLikeComment(comment.id)}
                                aria-label={`Like comment by ${comment.username}`}
                                aria-pressed={comment.isLiked}
                            >
                                <Heart size={16} />
                                {comment.likes > 0 && (
                                    <span className="comment-item__like-count">{comment.likes}</span>
                                )}
                            </button>
                        </div>
                    ))}
                </div>

                <form className="comments-panel__form" onSubmit={handleSubmit}>
                    <input
                        ref={commentInputRef}
                        type="text"
                        className="comments-panel__input"
                        placeholder="Add a comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        maxLength={150}
                    />

                    <button
                        type="button"
                        className="comments-panel__emoji-button"
                        aria-label="Add emoji"
                    >
                        <Smile size={20} />
                    </button>

                    <button
                        type="submit"
                        className={`comments-panel__submit-button ${!newComment.trim() || isSubmitting ? 'comments-panel__submit-button--disabled' : ''}`}
                        disabled={!newComment.trim() || isSubmitting}
                        aria-label="Post comment"
                    >
                        <Send size={20} />
                    </button>
                </form>
            </div>
        </div>
    );
}
