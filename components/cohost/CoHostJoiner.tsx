import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { connectAsCoHost } from '../../services/webrtcService';
import '../../styles/cohost.css';

export type CoHostJoinerHandle = { cleanup: () => void };

export default forwardRef<CoHostJoinerHandle, { liveId: string; onLeft?: () => void }>(function CoHostJoiner({ liveId, onLeft }, ref) {
  const localRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cleanup: (() => void) | null = null;
    async function run() {
      try {
        const res = await connectAsCoHost(liveId, localRef.current as HTMLVideoElement);
        cleanup = res.cleanup;
        cleanupRef.current = res.cleanup;
        setJoined(true);
      } catch (e: any) {
        setError(e?.message || String(e));
      }
    }
    run();
    return () => { try { cleanup?.(); } catch {} };
  }, [liveId]);

  useImperativeHandle(ref, () => ({ cleanup: () => { try { cleanupRef.current?.(); onLeft?.(); } catch {} } }), [onLeft]);

  return (
    <div className="cohost-panel">
      <div className="cohost-panel-title">Co-host local preview</div>
      <div className="cohost-video" style={{ minHeight: 160 }}>
        <video
          ref={localRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={(e) => {
            const el = e.currentTarget as HTMLVideoElement;
            const w = el.videoWidth, h = el.videoHeight;
            if (w && h) {
              const r = w / h;
              el.setAttribute('data-source', r >= 1.2 ? 'landscape' : (r <= 0.9 ? 'mobile' : 'square'));
            }
            // attempt autoplay if blocked
            el.play().catch(() => {
              const once = { once: true } as AddEventListenerOptions;
              const resume = () => el.play().catch(() => {});
              document.addEventListener('click', resume, once);
              document.addEventListener('touchstart', resume, once);
              document.addEventListener('keydown', resume, once);
            });
          }}
        />
      </div>
      {error && <div className="cohost-alert" style={{ color: '#f87171', marginTop: 6 }}>{error}</div>}
      {joined && <div className="cohost-alert" style={{ color: '#34d399', marginTop: 6 }}>Connected as co-host</div>}
    </div>
  );
});
