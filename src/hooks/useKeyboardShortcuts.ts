import { useEffect } from 'react';

type Handlers = {
  onUp?: () => void;
  onDown?: () => void;
  onMuteToggle?: () => void;
};

export function useKeyboardShortcuts({ onUp, onDown, onMuteToggle }: Handlers) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        onDown?.();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        onUp?.();
      } else if (e.key.toLowerCase() === 'm') {
        onMuteToggle?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onUp, onDown, onMuteToggle]);
}
