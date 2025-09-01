import { useEffect } from 'react';
import '../../styles/components/FeedList.css';
import LiveCard from './LiveCard';
import type { Live } from '../../types/live';
import { useInfiniteLives } from '../../hooks/useInfiniteLives';
import { useFeedSnap } from '../../hooks/useFeedSnap';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

export default function FeedList({ filterFollowed = false }: { filterFollowed?: boolean }) {
  const { items, loadMore, hasMore } = useInfiniteLives();
  const { containerRef, activeIndex: _activeIndex, next, prev } = useFeedSnap();

  // keyboard shortcuts: arrows to navigate, M to mute (noop here)
  useKeyboardShortcuts({ onDown: next, onUp: prev, onMuteToggle: () => {} });

  const filtered: Live[] = filterFollowed ? items.filter((l: Live) => !!l.isFollowed) : items;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const sentinel = el.querySelector('#feed-end');
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) loadMore();
    }, { root: el, rootMargin: '400px' });
    if (sentinel) obs.observe(sentinel);
    return () => obs.disconnect();
  }, [containerRef, loadMore, hasMore]);

  return (
    <div ref={containerRef} className="feedContainer h-[calc(100vh-4rem)] snap-y snap-mandatory overflow-auto" aria-label="feed">
      {filtered.map((l: Live) => (
        <div key={l.id} className="snap-start h-full flex items-center justify-center">
          <div className="w-full flex items-center justify-center">
            <div className="max-w-[600px] w-full px-2">
              <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
                <div className="relative mx-auto aspect-[9/16] w-full max-w-[600px] rounded-2xl overflow-hidden shadow-lg bg-black">
                  <LiveCard live={l} />
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
      <div id="feed-end" className="h-24" />
    </div>
  );
}
