import { useState, useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import '../../styles/components/feed/VerticalFeed.css';

interface VerticalFeedProps {
  children: React.ReactNode[];
  onIndexChange?: (index: number) => void;
  initialIndex?: number;
  className?: string;
}

/**
 * TikTok-style vertical feed component with snap scrolling
 * Handles full-screen scrolling with snap points for each item
 */
export default function VerticalFeed({
  children,
  onIndexChange,
  initialIndex = 0,
  className = '',
}: VerticalFeedProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isScrolling, setIsScrolling] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Minimum swipe distance to trigger navigation (in px)
  const minSwipeDistance = 50;

  // Handle scroll event to determine current index
  const handleScroll = () => {
    if (!feedRef.current) return;

    const { scrollTop, clientHeight } = feedRef.current;
    const index = Math.round(scrollTop / clientHeight);

    if (index !== currentIndex) {
      setCurrentIndex(index);
      if (onIndexChange) onIndexChange(index);
    }
  };

  // Scroll to specific index
  const scrollToIndex = (index: number) => {
    if (!feedRef.current) return;

    const targetIndex = Math.max(0, Math.min(index, children.length - 1));

    setIsScrolling(true);

    feedRef.current.scrollTo({
      top: targetIndex * feedRef.current.clientHeight,
      behavior: 'smooth'
    });

    setCurrentIndex(targetIndex);
    if (onIndexChange) onIndexChange(targetIndex);

    // Reset scrolling state after animation
    setTimeout(() => {
      setIsScrolling(false);
    }, 500);
  };

  // Handle key navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isScrolling) return;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        scrollToIndex(currentIndex - 1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        scrollToIndex(currentIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isScrolling]);

  // Handle touch events for swipe navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientY);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isSignificantSwipe = Math.abs(distance) > minSwipeDistance;

    if (isSignificantSwipe) {
      // Swipe up (negative distance) means navigate to next item
      if (distance > 0 && currentIndex < children.length - 1) {
        scrollToIndex(currentIndex + 1);
      }
      // Swipe down (positive distance) means navigate to previous item
      else if (distance < 0 && currentIndex > 0) {
        scrollToIndex(currentIndex - 1);
      }
    }
  };

  // Handle mouse wheel events
  const handleWheel = (e: React.WheelEvent) => {
    if (isScrolling) return;

    // Debounce wheel events to prevent rapid scrolling
    setIsScrolling(true);

    if (e.deltaY > 0 && currentIndex < children.length - 1) {
      scrollToIndex(currentIndex + 1);
    } else if (e.deltaY < 0 && currentIndex > 0) {
      scrollToIndex(currentIndex - 1);
    } else {
      setIsScrolling(false);
    }
  };

  return (
    <div className={`vertical-feed-container ${className}`}>
      <div
        ref={feedRef}
        className="vertical-feed"
        onScroll={handleScroll}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children.map((child, index) => (
          <div key={index} className="vertical-feed__item">
            {child}
          </div>
        ))}
      </div>

      {/* Navigation buttons */}
      <div className="vertical-feed__navigation">
        {currentIndex > 0 && (
          <button
            className="vertical-feed__nav-button vertical-feed__nav-button--up"
            onClick={() => scrollToIndex(currentIndex - 1)}
            aria-label="Previous item"
          >
            <ChevronUp />
          </button>
        )}
        {currentIndex < children.length - 1 && (
          <button
            className="vertical-feed__nav-button vertical-feed__nav-button--down"
            onClick={() => scrollToIndex(currentIndex + 1)}
            aria-label="Next item"
          >
            <ChevronDown />
          </button>
        )}
      </div>

      {/* Progress indicator */}
      <div className="vertical-feed__progress">
        {children.map((_, index) => (
          <div
            key={index}
            className={`vertical-feed__progress-dot ${index === currentIndex ? 'vertical-feed__progress-dot--active' : ''
              }`}
            onClick={() => scrollToIndex(index)}
            role="button"
            tabIndex={0}
            aria-label={`Go to item ${index + 1} of ${children.length}`}
          />
        ))}
      </div>
    </div>
  );
}
