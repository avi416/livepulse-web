import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Loader } from 'lucide-react';
import '../styles/components/VideoPlayer.css';

interface VideoPlayerProps {
    src: string;
    poster?: string;
    autoPlay?: boolean;
    loop?: boolean;
    muted?: boolean;
    className?: string;
    onPlay?: () => void;
    onPause?: () => void;
    onEnded?: () => void;
    onVolumeChange?: (volume: number, muted: boolean) => void;
    onProgress?: (progress: number) => void;
    onDoubleTap?: () => void;
}

export default function VideoPlayer({
    src,
    poster,
    autoPlay = false,
    loop = true,
    muted = true,
    className = '',
    onPlay,
    onPause,
    onEnded,
    onVolumeChange,
    onProgress,
    onDoubleTap
}: VideoPlayerProps) {
    const [isPlaying, setIsPlaying] = useState(autoPlay);
    const [isMuted, setIsMuted] = useState(muted);
    const [volume, setVolume] = useState(1);
    const [progress, setProgress] = useState(0);
    const [showControls, setShowControls] = useState(false);
    const [loading, setLoading] = useState(true);
    const [lastTap, setLastTap] = useState(0);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const hideControlsTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Handle video loading
    useEffect(() => {
        if (videoRef.current) {
            const handleLoadStart = () => setLoading(true);
            const handleCanPlay = () => setLoading(false);

            videoRef.current.addEventListener('loadstart', handleLoadStart);
            videoRef.current.addEventListener('canplay', handleCanPlay);

            return () => {
                if (videoRef.current) {
                    videoRef.current.removeEventListener('loadstart', handleLoadStart);
                    videoRef.current.removeEventListener('canplay', handleCanPlay);
                }
            };
        }
    }, [src]);

    // Update video element when props change
    useEffect(() => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.play().catch(() => setIsPlaying(false));
            } else {
                videoRef.current.pause();
            }

            videoRef.current.muted = isMuted;
            videoRef.current.volume = volume;
            videoRef.current.loop = loop;
        }
    }, [isPlaying, isMuted, volume, loop]);

    // Auto-hide controls
    useEffect(() => {
        if (showControls) {
            if (hideControlsTimerRef.current) {
                clearTimeout(hideControlsTimerRef.current);
            }

            hideControlsTimerRef.current = setTimeout(() => {
                setShowControls(false);
            }, 3000);
        }

        return () => {
            if (hideControlsTimerRef.current) {
                clearTimeout(hideControlsTimerRef.current);
            }
        };
    }, [showControls]);

    // Handle playback events
    const handlePlay = () => {
        setIsPlaying(true);
        if (onPlay) onPlay();
    };

    const handlePause = () => {
        setIsPlaying(false);
        if (onPause) onPause();
    };

    const handleEnded = () => {
        if (!loop) setIsPlaying(false);
        if (onEnded) onEnded();
    };

    // Handle progress updates
    const handleTimeUpdate = () => {
        if (videoRef.current) {
            const currentProgress =
                videoRef.current.currentTime / videoRef.current.duration;
            setProgress(currentProgress);
            if (onProgress) onProgress(currentProgress);
        }
    };

    // Toggle play/pause
    const togglePlayPause = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play().catch(err => console.error('Error playing video:', err));
            }
        }
    };

    // Toggle mute
    const toggleMute = () => {
        const newMutedState = !isMuted;
        setIsMuted(newMutedState);
        if (onVolumeChange) onVolumeChange(volume, newMutedState);
    };

    // Handle volume change
    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        setIsMuted(newVolume === 0);
        if (videoRef.current) videoRef.current.volume = newVolume;
        if (onVolumeChange) onVolumeChange(newVolume, newVolume === 0);
    };

    // Seek to position
    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (videoRef.current) {
            const seekTo = parseFloat(e.target.value) * videoRef.current.duration;
            videoRef.current.currentTime = seekTo;
            setProgress(parseFloat(e.target.value));
        }
    };

    // Toggle fullscreen
    const toggleFullscreen = () => {
        if (containerRef.current) {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                containerRef.current.requestFullscreen();
            }
        }
    };

    // Handle tap/click to toggle controls
    const handleTap = () => {
        // Check for double tap
        const now = Date.now();
        const DOUBLE_TAP_DELAY = 300; // ms

        if (now - lastTap < DOUBLE_TAP_DELAY) {
            // Double tap occurred
            if (onDoubleTap) onDoubleTap();
            setLastTap(0); // Reset
        } else {
            setLastTap(now);
            setShowControls(!showControls);
        }
    };

    // Handle intersection observer for autoplay
    useEffect(() => {
        if (!videoRef.current || !autoPlay) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        if (videoRef.current) {
                            videoRef.current.play().catch(err => console.error('Error playing video:', err));
                            setIsPlaying(true);
                        }
                    } else {
                        if (videoRef.current) {
                            videoRef.current.pause();
                            setIsPlaying(false);
                        }
                    }
                });
            },
            { threshold: 0.5 }
        );

        if (videoRef.current) {
            observer.observe(videoRef.current);
        }

        return () => {
            if (videoRef.current) {
                observer.unobserve(videoRef.current);
            }
        };
    }, [autoPlay]);

    return (
        <div
            ref={containerRef}
            className={`video-player ${className} ${showControls ? 'video-player--controls-visible' : ''}`}
            onClick={handleTap}
        >
            {loading && src && (
                <div className="video-player__loader">
                    <Loader size={48} className="video-player__loader-icon" />
                </div>
            )}

            {src ? (
                <video
                    ref={videoRef}
                    className="video-player__video"
                    src={src}
                    poster={poster}
                    playsInline
                    muted={isMuted}
                    loop={loop}
                    onPlay={handlePlay}
                    onPause={handlePause}
                    onEnded={handleEnded}
                    onTimeUpdate={handleTimeUpdate}
                />
            ) : (
                <div className="video-player__placeholder">
                    {poster ? (
                        <img src={poster} alt="Video thumbnail" className="video-player__placeholder-img" />
                    ) : (
                        <div className="video-player__no-stream">Stream not available</div>
                    )}
                </div>
            )}

            {/* Tap overlay */}
            <div className="video-player__tap-overlay" />

            {/* Controls overlay */}
            <div className={`video-player__controls ${showControls ? 'video-player__controls--visible' : ''}`}>
                {/* Progress bar */}
                <div className="video-player__progress">
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.001"
                        value={progress}
                        onChange={handleSeek}
                        className="video-player__progress-bar"
                        aria-label="Video progress"
                    />
                    <div
                        className="video-player__progress-fill"
                        style={{ width: `${progress * 100}%` }}
                    />
                </div>

                {/* Bottom controls */}
                <div className="video-player__controls-bottom">
                    <button
                        className="video-player__control-button"
                        onClick={(e) => { e.stopPropagation(); togglePlayPause(); }}
                        aria-label={isPlaying ? 'Pause' : 'Play'}
                    >
                        {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                    </button>

                    <div className="video-player__volume-control">
                        <button
                            className="video-player__control-button"
                            onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                            aria-label={isMuted ? 'Unmute' : 'Mute'}
                        >
                            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                        </button>

                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={volume}
                            onChange={handleVolumeChange}
                            className="video-player__volume-slider"
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Volume"
                        />
                    </div>

                    <button
                        className="video-player__control-button"
                        onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                        aria-label="Fullscreen"
                    >
                        <Maximize size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
}
