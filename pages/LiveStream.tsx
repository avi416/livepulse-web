import { useRef, useState, useEffect } from "react";
import { createBroadcasterPC } from "../services/webrtcService";
import { startLiveStream } from "../services/streamService";
import '../styles/components/watch-video.css';

export default function LiveStream() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [stageMode, setStageMode] = useState<'portrait' | 'landscape' | 'square'>('landscape');

  // Detect local preview aspect
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const check = () => {
      if (v.videoWidth && v.videoHeight) {
        const ratio = v.videoWidth / v.videoHeight;
        if (ratio >= 1.2) { v.setAttribute('data-source', 'landscape'); setStageMode('landscape'); }
        else if (ratio <= 0.9) { v.setAttribute('data-source', 'mobile'); setStageMode('portrait'); }
        else { v.setAttribute('data-source', 'square'); setStageMode('square'); }
      }
    };
    v.addEventListener('loadedmetadata', check);
    return () => { v.removeEventListener('loadedmetadata', check); };
  }, []);

  const startLive = async () => {
    try {
      // 📹 בקשת גישה למצלמה ולמיקרופון
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (!stream) throw new Error("getUserMedia returned null");

      // מציגים פריוויו במסך המקומי
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // 📝 יוצרים רשומת liveStreams בפיירסטור
      const id = await startLiveStream("My Live Stream");
      setStreamId(id);

      // 🎥 יצירת PeerConnection עם ה־MediaStream
      await createBroadcasterPC(stream, id);

      setIsLive(true);
    } catch (err) {
      console.error("Camera or signalling error:", err);
      alert("לא ניתן להפעיל מצלמה/מיקרופון או להתחיל שידור");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      <h1 className="text-2xl font-bold mb-6">🎥 Live Stream</h1>

      <div className="w-full max-w-[800px]">
        <div className="ws-watch" style={{ minHeight: 0 }}>
          <div className="video-stage" data-mode={stageMode}>
            <video ref={videoRef} autoPlay playsInline muted className="video-el" data-source="default" />
          </div>
        </div>
      </div>

      {!isLive && (
        <button
          onClick={startLive}
          className="mt-6 px-6 py-3 bg-pink-600 rounded-lg text-lg hover:bg-pink-700"
        >
          Start Live
        </button>
      )}

      {streamId && (
        <div className="mt-4 text-sm text-gray-300">Stream ID: {streamId}</div>
      )}
    </div>
  );
}
