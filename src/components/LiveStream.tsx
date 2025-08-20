import { useRef, useState } from "react";
import { createBroadcasterPC } from "../services/webrtcService";
import { startLiveStream } from "../services/streamService";

export default function LiveStream() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const startLive = async () => {
    try {
      console.log("🎥 Requesting camera + mic...");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

      if (!stream) {
        throw new Error("No MediaStream received from getUserMedia");
      }

      // שמור את ה־MediaStream
      setLocalStream(stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // צור רשומת liveStreams בפיירסטור
      const id = await startLiveStream("My Live Stream");
      setStreamId(id);

      console.log("📡 Creating Broadcaster PC with stream:", stream);
      await createBroadcasterPC(stream, id);

      setIsLive(true);
    } catch (err) {
      console.error("❌ Failed to start broadcast:", err);
      alert("לא ניתן להפעיל מצלמה/מיקרופון או להתחיל שידור");
    }
  };

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
