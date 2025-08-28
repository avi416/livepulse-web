import { useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot } from 'firebase/firestore';
import { createBroadcasterPC } from "../services/webrtcService";
import { endLiveStream, heartbeatLiveStream, startLiveStream, subscribeToRequests, type JoinRequestDoc, type LiveStreamDoc as LiveDocSrv } from "../services/streamService";
import RequestsPanel from "./cohost/RequestsPanel";
import HostCohostController from "./cohost/HostCohostController";
import "../styles/cohost.css";
import { useCoHostMixer } from "../hooks/useCoHostMixer";
import StopLiveButton from './cohost/StopLiveButton';
import useAuthUser from '../hooks/useAuthUser';
import { getFirestoreInstance } from "../services/firebase";
import { useIsHost } from "../hooks/useIsHost";
import { normalizeLiveDoc } from "../utils/liveDoc";

export default function LiveStream() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [localIsHost, setLocalIsHost] = useState(false);
  // Host UI is fixed 16:9 medium preview; no stage mode on host page
  const broadcasterRef = useRef<null | { pc: RTCPeerConnection; unsubAnswer?: () => void; unsubViewerICE?: () => void; stream?: MediaStream }>(null);
  const startedRef = useRef(false);

  // Debug overlay toggle (dev-only)
  const [showDebug, setShowDebug] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') setShowDebug((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const startLive = async () => {
    if (startedRef.current) {
      console.log('⏭️ startLive ignored (already started)');
      return;
    }
    startedRef.current = true;
    try {
      console.log("🎥 Requesting camera + mic...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });

      if (!stream) {
        throw new Error("No MediaStream received from getUserMedia");
      }

  if (videoRef.current) {
        const v = videoRef.current;
        v.srcObject = stream;
        v.muted = true; // allow autoplay for local preview
        v.playsInline = true;
        v.autoplay = true;
        // diagnostics
        try {
          v.onloadedmetadata = () => console.log('host video loadedmetadata');
          v.oncanplay = () => console.log('host video canplay');
          v.onplay = () => console.log('host video playing');
          v.onerror = (e: any) => console.error('host video error', e);
        } catch {}
        try {
          await v.play();
          console.log('▶️ Host preview started');
        } catch (err) {
          console.warn('⚠️ Host preview autoplay blocked, will start on user gesture:', err);
          const resume = () => {
            v.play().catch((e) => console.warn('❌ Host preview still failed to play:', e));
          };
          const once = { once: true } as AddEventListenerOptions;
          document.addEventListener('click', resume, once);
          document.addEventListener('touchstart', resume, once);
          document.addEventListener('keydown', resume, once);
        }
      }

      // צור רשומת liveStreams בפיירסטור
      const id = await startLiveStream("My Live Stream");
      setStreamId(id);

      console.log("📡 Creating Broadcaster PC with stream:", stream);
  const res = await createBroadcasterPC(stream, id);
  broadcasterRef.current = { ...res, stream } as any;

      setIsLive(true);
      // Optimistically mark this session as host without waiting for Firestore snapshot
      setLocalIsHost(true);
    } catch (err) {
      console.error("❌ Failed to start broadcast:", err);
      alert("לא ניתן להפעיל מצלמה/מיקרופון או להתחיל שידור");
      startedRef.current = false;
    }
  };

  const endLive = async () => {
  // Prevent duplicate end attempts
  if ((endLive as any)._ending) return;
  (endLive as any)._ending = true;
    if (!streamId) return;
    console.log("🛑 Ending live:", streamId);
    try {
      // Stop local tracks
      const stream = (broadcasterRef.current as any)?.stream as MediaStream | undefined;
      stream?.getTracks().forEach((t) => {
        try { t.stop(); } catch {}
      });
      // Close PC and unsubscribe
      try { broadcasterRef.current?.unsubAnswer?.(); } catch {}
      try { broadcasterRef.current?.unsubViewerICE?.(); } catch {}
      try { broadcasterRef.current?.pc?.close(); } catch {}
      broadcasterRef.current = null;

      // Mark as ended in Firestore
      await endLiveStream(streamId);
    } catch (e) {
      console.warn("⚠️ Failed to end live cleanly:", e);
    } finally {
      setIsLive(false);
  (endLive as any)._ending = false;
    }
  };

  // Keep heartbeat active while live; only end on explicit Stop Live or true page unload
  useEffect(() => {
    let hb: number | null = null;
    if (isLive && streamId) {
      heartbeatLiveStream(streamId).catch(() => {});
      hb = window.setInterval(() => heartbeatLiveStream(streamId!).catch(() => {}), 15_000);
    }
    const handleBeforeUnload = () => { try { navigator.sendBeacon?.('/noop'); } catch {} };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      if (hb) try { window.clearInterval(hb); } catch {}
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Do not stop/close here if still live; only Stop Live does cleanup
    };
  }, [isLive, streamId]);

  const hostLocal = (broadcasterRef.current as any)?.stream || null;
  const broadcasterPC = (broadcasterRef.current as any)?.pc || null;

  const [reqs, setReqs] = useState<(JoinRequestDoc & { id: string })[]>([]);
  useEffect(() => {
    if (!streamId) return;
    const unsub = subscribeToRequests(streamId, setReqs);
    return () => { try { unsub(); } catch {} };
  }, [streamId]);
  const approvedId = useMemo(() => reqs.find(r => r.status === 'approved')?.id || '', [reqs]);
  const { remote } = useCoHostMixer(streamId || '', approvedId, hostLocal, broadcasterPC);

  // Determine if current user is the host of this live
  const { user: authUser } = useAuthUser();
  const [streamDoc, setStreamDoc] = useState<LiveDocSrv | null>(null);
  useEffect(() => {
    if (!streamId) return;
    const db = getFirestoreInstance();
    const ref = doc(db, 'liveStreams', streamId);
    const unsub = onSnapshot(ref, (snap: any) => {
      if (!snap.exists()) { setStreamDoc(null); return; }
      const raw = snap.data() as LiveDocSrv;
      const norm = normalizeLiveDoc(raw) as LiveDocSrv;
      setStreamDoc(norm);
    });
    return () => { try { unsub(); } catch {} };
  }, [streamId]);
  const isHost = useIsHost(streamDoc, authUser?.uid ?? null, localIsHost);

  useEffect(() => {
    // Debug host detection
    // eslint-disable-next-line no-console
    console.log('👤 Host detection', {
      authUid: authUser?.uid,
      docUserId: streamDoc?.userId,
      localIsHost,
      isHost,
    });
  }, [authUser?.uid, streamDoc?.userId, localIsHost, isHost]);

  return (
    <div style={{ minHeight: '100vh', background: '#111827', color: '#fff', padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Live Stream</h1>

      <div className="cohost-layout">
        <div className="cohost-videos">
          <div className="cohost-video">
            <div className="aspect-16-9">
              <video ref={videoRef} autoPlay playsInline muted />
            </div>
          </div>
          {remote && (
            <div className="cohost-video">
              <div className="aspect-16-9">
                <video
                  autoPlay
                  playsInline
                  muted
                  ref={(el) => { if (el) { el.srcObject = remote; } }}
                />
              </div>
            </div>
          )}
        </div>
        <div className="cohost-right-col">
          {isLive && streamId && isHost && (
            <>
              <RequestsPanel liveId={streamId} />
              <HostCohostController liveId={streamId} />
              <StopLiveButton onStop={endLive} />
            </>
          )}

          {!isLive && (
            <button onClick={startLive} className="cohost-btn cohost-btn-join">Start Live</button>
          )}
        </div>
      </div>

      {streamId && (
        <div style={{ marginTop: 12, fontSize: 12, color: '#d1d5db' }}>Stream ID: {streamId}</div>
      )}

      {/* Dev-only Debug Overlay: press "D" to toggle */}
      {import.meta.env.DEV && showDebug && (
        <div className="host-debug">
          <pre>{JSON.stringify({
            isLive,
            streamId,
            authUid: authUser?.uid ?? null,
            docUserId: streamDoc?.userId ?? null,
            localIsHost,
            isHost,
            areHostControlsRendering: Boolean(isLive && streamId && isHost),
          }, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
