import { useEffect, useRef, useState } from "react";
import { createBroadcasterPC } from "../services/webrtcService";
import { endLiveStream, heartbeatLiveStream, startLiveStream } from "../services/streamService";

export default function LiveStream() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [streamId, setStreamId] = useState<string | null>(null);
  const broadcasterRef = useRef<null | { pc: RTCPeerConnection; unsubAnswer?: () => void; unsubViewerICE?: () => void; stream?: MediaStream }>(null);

  const startLive = async () => {
    try {
      console.log("🎥 Requesting camera + mic...");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

      if (!stream) {
        throw new Error("No MediaStream received from getUserMedia");
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // צור רשומת liveStreams בפיירסטור
      const id = await startLiveStream("My Live Stream");
      setStreamId(id);

  console.log("📡 Creating Broadcaster PC with stream:", stream);
  const res = await createBroadcasterPC(stream, id);
  broadcasterRef.current = { ...res, stream } as any;

      setIsLive(true);
    } catch (err) {
      console.error("❌ Failed to start broadcast:", err);
      alert("לא ניתן להפעיל מצלמה/מיקרופון או להתחיל שידור");
    }
  };

  const endLive = async () => {
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
    }
  };

  // Attempt to end when navigating away/tab hidden
  useEffect(() => {
    let hb: number | null = null;
    // heartbeat while live
    if (isLive && streamId) {
      hb = window.setInterval(() => heartbeatLiveStream(streamId).catch(() => {}), 15_000);
    }
    const handleBeforeUnload = () => {
      // Fire-and-forget; may not always complete but helps
      if (isLive && streamId) {
        try { navigator.sendBeacon && navigator.sendBeacon("/noop"); } catch {}
        // Best-effort: not guaranteed to finish
        endLiveStream(streamId).catch(() => {});
      }
    };
    const handleVisibility = () => {
      if (document.hidden && isLive && streamId) {
        endLiveStream(streamId).catch(() => {});
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      if (hb) {
        try { window.clearInterval(hb); } catch {}
      }
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibility);
      // Component unmount cleanup
      if (isLive) {
        if (streamId) {
          endLiveStream(streamId).catch(() => {});
        }
        const stream = (broadcasterRef.current as any)?.stream as MediaStream | undefined;
        stream?.getTracks().forEach((t) => { try { t.stop(); } catch {} });
        try { broadcasterRef.current?.pc?.close(); } catch {}
      }
    };
  }, [isLive, streamId]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
      <h1 className="text-2xl font-bold mb-6">🎥 Live Stream</h1>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-[600px] max-w-full rounded-lg shadow-lg bg-black"
      />

      {!isLive ? (
        <button
          onClick={startLive}
          className="mt-6 px-6 py-3 bg-pink-600 rounded-lg text-lg hover:bg-pink-700"
        >
          Start Live
        </button>
      ) : (
        <button
          onClick={endLive}
          className="mt-6 px-6 py-3 bg-red-600 rounded-lg text-lg hover:bg-red-700"
        >
          End Live
        </button>
      )}

      {streamId && (
        <div className="mt-4 text-sm text-gray-300">Stream ID: {streamId}</div>
      )}
    </div>
  );
}
