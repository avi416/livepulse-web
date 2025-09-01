import { useRef, useState } from "react";
import { connectAsViewer } from "../services/webrtcService";

export default function Viewer() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [streamId, setStreamId] = useState("");
  const [isWatching, setIsWatching] = useState(false);

  const startWatching = async () => {
    try {
      if (!streamId) {
        alert("נא להזין Stream ID");
        return;
      }
      if (!videoRef.current) {
        alert("Video element missing!");
        return;
      }

      await connectAsViewer(streamId, videoRef.current);
      setIsWatching(true);
    } catch (err) {
      console.error("❌ Failed to join stream:", err);
      alert("שגיאה בהתחברות לשידור");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
      <h1 className="text-2xl font-bold mb-6">👀 Watch Live Stream</h1>

      <input
        type="text"
        placeholder="Enter Stream ID"
        value={streamId}
        onChange={(e) => setStreamId(e.target.value)}
        className="mb-4 px-4 py-2 rounded text-black w-80"
      />

      <button
        onClick={startWatching}
        className="px-6 py-3 bg-green-600 rounded-lg text-lg hover:bg-green-700"
      >
        Watch
      </button>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        controls
        className="w-[600px] max-w-full rounded-lg shadow-lg bg-black mt-6"
      />

      {isWatching && (
        <div className="mt-4 text-sm text-gray-300">
          Watching stream: {streamId}
        </div>
      )}
    </div>
  );
}
