import { useEffect, useRef, useState } from "react";
import { hostAcceptCoHost } from "../../services/webrtcService";

type HostCohostPanelProps = {
  streamId: string;                 // live stream id
  localStream: MediaStream;         // host’s camera+mic from useLocalMedia
  pendingCohostId?: string | null;  // the co-host userId selected for approval
};

export default function HostCohostPanel({
  streamId,
  localStream,
  pendingCohostId,
}: HostCohostPanelProps) {
  const cohostVideoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [muted, setMuted] = useState(true);
  // ensure singleton connection per cohost id
  const sessionRef = useRef<{ key: string; cleanup?: () => void } | null>(null);
  const connectingRef = useRef(false);

  // keep the co-host <video> configured but NEVER bind host preview here
  useEffect(() => {
    if (!cohostVideoRef.current) return;
    cohostVideoRef.current.autoplay = true;
    cohostVideoRef.current.playsInline = true;
    cohostVideoRef.current.muted = true; // allow autoplay; can unmute via UI if needed
    try { cohostVideoRef.current.removeAttribute('controls'); } catch {}
    cohostVideoRef.current.style.objectFit = "contain";
    cohostVideoRef.current.style.width = '100%';
  }, []);

  // keep muted state in sync with element
  useEffect(() => {
    if (!cohostVideoRef.current) return;
    cohostVideoRef.current.muted = muted;
  }, [muted]);

  // Approve flow – call hostAcceptCoHost and wire ONLY the cohost element
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!pendingCohostId || !localStream) return;
      const el = cohostVideoRef.current;
      if (!el) return; // wait until element mounted

      const key = `${streamId}:${pendingCohostId}`;
      // if session already established for this cohost, skip
      if (sessionRef.current?.key === key) return;
      if (connectingRef.current) return;
      connectingRef.current = true;

      // prepare element for live playback
      el.autoplay = true;
      el.playsInline = true;
      el.muted = true;
      try { el.removeAttribute('controls'); } catch {}
      try {
        if (!el.style.width) el.style.width = '360px';
        el.style.objectFit = 'contain';
      } catch {}

      try {
        setStatus('connecting');
        const { pc, cleanup: pcCleanup } = await hostAcceptCoHost(
          streamId,
          localStream,
          el,
          pendingCohostId
        );
        if (cancelled) {
          try { pcCleanup?.(); } catch {}
          try { pc.close(); } catch {}
          return;
        }
        sessionRef.current = { key, cleanup: pcCleanup };
        setStatus('connected');
      } catch (err) {
        console.error('hostAcceptCoHost failed:', err);
        setStatus('error');
      } finally {
        connectingRef.current = false;
      }
    };
    run();
    return () => {
      cancelled = true;
      const key = `${streamId}:${pendingCohostId}`;
      if (sessionRef.current?.key === key) {
        try { sessionRef.current.cleanup?.(); } catch {}
        sessionRef.current = null;
      }
    };
  }, [pendingCohostId, localStream, streamId]);

  return (
    <div className="host-cohost-panel p-3 rounded-md border border-blue-200 bg-white">
      <h3 className="font-semibold mb-2">Co-Host Panel</h3>
      <div className="video-tile mb-2">
        <video
          ref={cohostVideoRef}
          autoPlay
          playsInline
          muted
          style={{ width: '100%', borderRadius: 12, objectFit: 'contain' }}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Status: {status}</span>
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          className="ml-auto px-3 py-1 rounded-md text-sm border border-gray-300 hover:bg-gray-50"
        >
          {muted ? 'Unmute co-host' : 'Mute co-host'}
        </button>
      </div>
    </div>
  );
}
