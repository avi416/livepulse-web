import { useCallback, useEffect, useRef, useState } from 'react';

export function useFeedSnap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const scrollToIndex = useCallback((idx: number) => {
    const el = containerRef.current;
    if (!el) return;
    const children = Array.from(el.querySelectorAll<HTMLElement>('.snap-start'));
    const safe = Math.max(0, Math.min(children.length - 1, idx));
    const target = children[safe];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
      setActiveIndex(safe);
    }
  }, []);

  const next = useCallback(() => scrollToIndex(activeIndex + 1), [activeIndex, scrollToIndex]);
  const prev = useCallback(() => scrollToIndex(activeIndex - 1), [activeIndex, scrollToIndex]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const children = Array.from(el.querySelectorAll<HTMLElement>('.snap-start'));
      if (!children.length) return;
      const top = el.scrollTop;
      let closest = 0;
      let minDist = Infinity;
      children.forEach((c, i) => {
        const dist = Math.abs(c.offsetTop - top);
        if (dist < minDist) {
          minDist = dist;
          closest = i;
        }
      });
      setActiveIndex(closest);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, [containerRef]);

  return { containerRef, activeIndex, next, prev } as const;
}
