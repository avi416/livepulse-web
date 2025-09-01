import { useRef, useState, useCallback } from 'react';

type UseLocalMedia = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  start: () => Promise<void>;
  stop: () => void;
  isActive: boolean;
  error: string | null;
  stream: MediaStream | null;
};

export function useLocalMedia(): UseLocalMedia {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
      setIsActive(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to access media devices';
      setError(msg);
      setIsActive(false);
    }
  }, []);

  const stop = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setStream(null);
    setIsActive(false);
  }, [stream]);

  return { videoRef, start, stop, isActive, error, stream };
}
