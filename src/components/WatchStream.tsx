import { useEffect, useRef, useState } from 'react';
import { watcherJoin } from '../services/webrtcService';
import { getStreamById } from '../services/streamService';

interface Props { streamId: string }

export default function WatchStream({ streamId }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
  let cleanup: (() => void) | null = null;
    async function join() {
      const meta = await getStreamById(streamId);
      if (!meta) return setError('Stream not found');
      if (!videoRef.current) return;
      try {
    const res = await watcherJoin(streamId, videoRef.current);
    cleanup = res.cleanup;
      } catch (e: any) {
        setError(e.message);
      }
    }
    join();
  return () => { try { cleanup?.(); } catch {} };
  }, [streamId]);

  if (error) return <div>Error: {error}</div>;
  return <video ref={videoRef} autoPlay playsInline controls className="w-full h-auto bg-black" />;
}
