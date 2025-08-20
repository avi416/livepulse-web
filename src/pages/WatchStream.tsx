import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFirestoreInstance } from '../services/firebase';
import { connectAsViewer } from '../services/webrtcService';
import type { LiveStreamDoc } from '../services/liveStreams';
import UserAvatar from '../components/UserAvatar';

export default function WatchStream() {
  const { id } = useParams<{ id: string }>();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [streamData, setStreamData] = useState<LiveStreamDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('Waiting for stream...');
  const cleanupRef = useRef<(() => void) | null>(null);

  // debug: וידאו אלמנט
  useEffect(() => {
    if (!videoRef.current) return;
    const v = videoRef.current;

    v.autoplay = true;
    v.playsInline = true;
    v.controls = true;
    v.muted = false;

    v.onloadedmetadata = () => {
      console.log('🎥 loadedmetadata', {
        w: v.videoWidth, h: v.videoHeight, duration: v.duration,
      });
    };
    v.oncanplay = () => console.log('🎥 canplay');
    v.onplay = () => console.log('🎥 playing');
    v.onerror = (e) => console.error('🎥 video error', e);
  }, []);

  useEffect(() => {
    if (!id) return;

    const db = getFirestoreInstance();
    const streamRef = doc(db, 'liveStreams', id);

    console.log('👁️ Starting to watch stream:', id);

    const unsub = onSnapshot(
      streamRef,
      async (snap: any) => {
        if (!snap.exists()) {
          console.log('❌ Stream not found');
          setError('Stream not found');
          setConnectionStatus('Stream not found');
          setLoading(false);
          return;
        }

        const data = snap.data() as LiveStreamDoc;
        console.log('📡 Stream data updated:', data);
        setStreamData(data);

        // אם השידור הסתיים
        if (data.status === 'ended' && isConnected) {
          console.log('⏹️ Stream ended, disconnecting…');
          setIsConnected(false);
          setConnectionStatus('Stream has ended');
          if (cleanupRef.current) {
            cleanupRef.current();
            cleanupRef.current = null;
          }
          setLoading(false);
          return;
        }

        // אם השידור בלייב – חיבור
        if (data.status === 'live' && !isConnected) {
          console.log('🔍 DEBUG connect conditions:', {
            status: data.status,
            isConnected,
            hasVideoRef: !!videoRef.current,
          });

          // אם הוידאו עדיין לא מוכן – ננסה שוב בעוד 500ms
          if (!videoRef.current) {
            console.warn('⚠️ Video element not ready yet, retrying in 500ms…');
            setTimeout(() => {
              if (videoRef.current && !isConnected) {
                setConnectionStatus('Connecting to stream…');
                connectAsViewer(id, videoRef.current)
                  .then((result) => {
                    console.log('✅ Connection successful (retry):', result);
                    setIsConnected(true);
                    setConnectionStatus('Connected to stream');
                    cleanupRef.current = result.cleanup;
                  })
                  .catch((err: any) => {
                    console.error('❌ Failed to connect (retry):', err);
                    setError(err.message || 'Failed to connect to stream');
                    setConnectionStatus('Connection failed');
                  });
              }
            }, 500);
            setLoading(false);
            return;
          }

          // יש אלמנט וידאו – מתחברים עכשיו
          console.log('🔗 Stream is live, attempting connection…');
          setConnectionStatus('Connecting to stream…');
          try {
            const result = await connectAsViewer(id, videoRef.current);
            console.log('✅ Connection successful:', result);
            setIsConnected(true);
            setConnectionStatus('Connected to stream');
            cleanupRef.current = result.cleanup;
          } catch (err: any) {
            console.error('❌ Failed to connect:', err);
            setError(err.message || 'Failed to connect to stream');
            setConnectionStatus('Connection failed');
          }
        }

        setLoading(false);
      },
      (err: Error) => {
        console.error('❌ Error listening to stream:', err);
        setError('Failed to load stream');
        setConnectionStatus('Failed to load stream');
        setLoading(false);
      }
    );

    return () => {
      console.log('🧹 Cleaning up stream listener');
      unsub();
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, [id, isConnected]);

  if (loading) {
    return (
      <div className="pt-12 max-w-4xl mx-auto p-4">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !streamData) {
    return (
      <div className="pt-12 max-w-4xl mx-auto p-4">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-white mb-4">Stream Not Found</h2>
          <p className="text-[var(--muted)] mb-6">{error || 'This stream could not be loaded.'}</p>
          <Link
            to="/"
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-12 max-w-4xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 p-4 bg-[var(--panel)] rounded-lg">
        <UserAvatar
          photoURL={streamData.photoURL}
          displayName={streamData.displayName}
          email={streamData.displayName}
          size={48}
        />
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-white">{streamData.title}</h1>
          <p className="text-[var(--muted)]">{streamData.displayName}</p>
        </div>
        <span className="px-3 py-1 bg-red-600 text-white text-sm font-medium rounded-full">LIVE</span>
      </div>

      {/* Status */}
      <div className="mb-4 text-center">
        <div
          className={`inline-block px-3 py-1 rounded-full text-sm ${
            isConnected ? 'bg-green-600 text-white' : 'bg-yellow-600 text-white'
          }`}
        >
          {connectionStatus}
        </div>
      </div>

      {/* Video */}
      <div className="flex justify-center mb-6">
        <div className="relative w-full max-w-md">
          <div className="aspect-[9/16] w-full rounded-lg overflow-hidden bg-black">
           <video
  ref={videoRef}
  autoPlay
  playsInline
  controls
  muted    // 👈 חובה בשביל autoplay לעבוד
  className="w-full h-full object-cover bg-black"
/>

          </div>
        </div>
      </div>

      {/* Debug Info */}
      <div className="mt-6 p-3 bg-gray-800 rounded text-xs text-gray-300">
        <div>Stream ID: {id}</div>
        <div>Status: {streamData.status}</div>
        <div>Connected: {isConnected ? 'Yes' : 'No'}</div>
        <div>Connection Status: {connectionStatus}</div>
        <div>Video Element: {videoRef.current ? 'Ready' : 'Not Ready'}</div>
        <div>Video srcObject: {videoRef.current?.srcObject ? 'Set' : 'Not Set'}</div>
        <div>
          Video Tracks:{' '}
          {videoRef.current?.srcObject
            ? (videoRef.current.srcObject as MediaStream)?.getTracks().length || 0
            : 0}
        </div>
      </div>
    </div>
  );
}
