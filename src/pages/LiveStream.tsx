import { useRef, useState } from "react";
import { createBroadcasterPC } from "../services/webrtcService";
import { startLiveStream } from "../services/streamService";
import LiveInteractions from "../components/live/LiveInteractions";
import "../styles/pages/LiveStream.css";

export default function LiveStream() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [streamId, setStreamId] = useState<string | null>(null);

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
    <div className="live-stream">
      <h1 className="live-stream__title">Live Stream</h1>

      <div className="live-stream__video-container">
        <div className="live-stream__video-grid">
          <div className="live-stream__video-item">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="live-stream__video"
            />
            <div className="live-badge">Your Stream</div>
          </div>

          {/* Placeholder for second stream (for layout consistency) */}
          {isLive && (
            <div className="live-stream__video-item live-stream__video-item--placeholder">
              <div className="live-stream__video-placeholder">
                <span>Waiting for co-host...</span>
              </div>
            </div>
          )}
        </div>

        {isLive && (
          <div className="live-stream__interactions">
            <LiveInteractions
              initialLikes={124}
              initialComments={32}
              vertical={false}
            />
          </div>
        )}
      </div>

      <div className="live-stream__controls">
        {!isLive && (
          <button
            onClick={startLive}
            className="live-stream__button"
          >
            Start Live
          </button>
        )}
      </div>

      {streamId && (
        <div className="live-stream__info">Stream ID: {streamId}</div>
      )}
    </div>
  );
}
