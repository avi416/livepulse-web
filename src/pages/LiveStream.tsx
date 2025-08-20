import { useEffect, useRef, useState } from 'react';
import { useLocalMedia } from '../hooks/useLocalMedia';
import { createBroadcasterPC, broadcasterCreateOffer, watcherJoin } from '../services/webrtcService';
import { startLiveStream, endLiveStream } from '../services/liveStreams';
import useAuthUser from '../hooks/useAuthUser';

export default function LiveStreamPage() {
  const { videoRef, start, stop, isActive, error, stream } = useLocalMedia();
  const remoteRef = useRef<HTMLVideoElement | null>(null);
  const [streamIdInput, setStreamIdInput] = useState('');
  const [myStreamId, setMyStreamId] = useState<string | null>(null);
  const [title, setTitle] = useState('My Live Stream');
  const { user } = useAuthUser();

  useEffect(() => {
    return () => {
      if (myStreamId) {
        endLiveStream(myStreamId).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myStreamId]);

  const startBroadcast = async () => {
    await start();
    if (!user) {
      alert('You must be signed in to go live');
      return;
    }
    const id = await startLiveStream(title || 'Live');
    setMyStreamId(id);

    const broadcaster = createBroadcasterPC(stream, id, (s) => {
      if (remoteRef.current) remoteRef.current.srcObject = s;
    });
    await broadcasterCreateOffer(broadcaster);
  };

  const joinAsPeer = async () => {
    await start();
    const id = streamIdInput.trim();
    if (!id) return alert('Enter stream id');
    setMyStreamId(id);
    await watcherJoin(id, remoteRef.current as HTMLVideoElement, stream);
  };

  const stopBroadcast = async () => {
    await stop();
    if (myStreamId) {
      await endLiveStream(myStreamId);
      setMyStreamId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-2xl font-bold mb-6">🎥 Go Live (Peer)</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col items-center">
          <h2 className="mb-2">Local Preview</h2>
          <video ref={videoRef} autoPlay playsInline muted className="w-full max-w-md rounded bg-black" />
        </div>

        <div className="flex flex-col items-center">
          <h2 className="mb-2">Remote</h2>
          <video ref={remoteRef} autoPlay playsInline className="w-full max-w-md rounded bg-black" />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-4 items-center">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Live title" className="px-2 py-1 rounded text-black" />
        <button onClick={startBroadcast} disabled={isActive} className="px-4 py-2 bg-green-600 rounded">Start Broadcast</button>
        <button onClick={joinAsPeer} disabled={isActive} className="px-4 py-2 bg-blue-600 rounded">Join by ID</button>
        <input value={streamIdInput} onChange={(e) => setStreamIdInput(e.target.value)} placeholder="stream id" className="px-2 py-1 rounded text-black" />
        {isActive && <button onClick={stopBroadcast} className="px-4 py-2 bg-red-600 rounded">Stop</button>}
      </div>

      {myStreamId && <div className="mt-4 text-sm text-gray-300">Active ID: {myStreamId}</div>}
      {error && <div className="mt-4 text-sm text-red-400">{error}</div>}
    </div>
  );
}
