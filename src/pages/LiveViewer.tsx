import React, { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { watcherJoin } from '../services/webrtcService';
import { useLocalMedia } from '../hooks/useLocalMedia';

export default function LiveViewer() {
  const { id } = useParams();
  const [error, setError] = useState<string | null>(null);
  const remoteRef = useRef<HTMLVideoElement | null>(null);
  const { start, stop, stream } = useLocalMedia();

  const join = async (streamId?: string) => {
    const sid = streamId ?? id;
    if (!sid) return setError('Missing stream id');
    try {
      await start();
      await watcherJoin(sid, remoteRef.current as HTMLVideoElement, stream);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    }
  };

  return (
    <div className="pt-12 max-w-3xl mx-auto p-4">
      <h2 className="text-2xl font-semibold">Viewer</h2>
      <p className="mt-2 text-[var(--muted)]">Join a live stream</p>

      <div className="mt-4">
        <button onClick={() => join()} className="px-4 py-2 bg-[var(--panel)] rounded">Join</button>
      </div>

      <div className="mt-6">
        <video ref={remoteRef} autoPlay playsInline className="w-full rounded bg-black" />
      </div>

      {error && <div className="mt-4 text-red-400">{error}</div>}
    </div>
  );
}
