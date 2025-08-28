import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { watcherJoin } from '../services/webrtcService';
import { useLocalMedia } from '../hooks/useLocalMedia';
import '../styles/components/watch-video.css';

export default function LiveViewer() {
  const { id } = useParams();
  const [error, setError] = useState<string | null>(null);
  const remoteRef = useRef<HTMLVideoElement | null>(null);
  const { start } = useLocalMedia();
  const [stageMode, setStageMode] = useState<'portrait' | 'landscape' | 'square'>('portrait');

  // Detect aspect and set data attributes
  const detectStreamSource = (videoElement: HTMLVideoElement) => {
    if (!videoElement) return;
    const check = () => {
      const { videoWidth, videoHeight } = videoElement;
      if (videoWidth && videoHeight) {
        const ratio = videoWidth / videoHeight;
        if (ratio >= 1.2) { videoElement.setAttribute('data-source', 'landscape'); setStageMode('landscape'); }
        else if (ratio <= 0.9) { videoElement.setAttribute('data-source', 'mobile'); setStageMode('portrait'); }
        else { videoElement.setAttribute('data-source', 'square'); setStageMode('square'); }
      }
    };
    check();
    videoElement.addEventListener('loadedmetadata', check);
  };

  const join = async (streamId?: string) => {
    const sid = streamId ?? id;
    if (!sid) return setError('Missing stream id');
    try {
      await start();
      const vid = remoteRef.current as HTMLVideoElement;
      await watcherJoin(sid, vid);
      detectStreamSource(vid);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    }
  };

  return (
    <div className="pt-12 max-w-3xl mx-auto p-4">
      <h2 className="text-2xl font-semibold">Viewer</h2>
      <p className="text-[var(--muted)]">Join a live stream</p>

      <div className="mt-4">
        <button onClick={() => join()} className="px-4 py-2 bg-[var(--panel)] rounded">Join</button>
      </div>

      <div className="mt-6 flex justify-center">
        <div className="ws-watch" style={{ minHeight: 0 }}>
          <div className="video-stage" data-mode={stageMode}>
            <video ref={remoteRef} autoPlay playsInline className="video-el" data-source="default" />
          </div>
        </div>
      </div>

      {error && <div className="mt-4 text-red-400">{error}</div>}
    </div>
  );
}
