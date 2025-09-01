import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFirestoreInstance } from '../services/firebase';
import { connectAsViewer, connectAsCoHost } from '../services/webrtcService';
import type { LiveStreamDoc } from '../services/liveStreams';
import UserAvatar from '../components/UserAvatar';
import { RequestToJoinButton, LeaveLiveButton } from '../components/cohost';
import { subscribeToCurrentUserRequest } from '../services/streamService';
import { useLocalMedia } from '../hooks/useLocalMedia';

export default function WatchStream() {
  const { id } = useParams<{ id: string }>();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [streamData, setStreamData] = useState<LiveStreamDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('Waiting for stream...');
  const cleanupRef = useRef<(() => void) | null>(null);
  const connectingRef = useRef(false);

  // Co-host specific state
  const [joinRequest, setJoinRequest] = useState<any>(null);
  const [isCoHost, setIsCoHost] = useState(false);
  const [coHostCleanup, setCoHostCleanup] = useState<(() => void) | null>(null);
  const { stream: localStream, start: startLocalMedia, stop: stopLocalMedia } = useLocalMedia();

  // Monitor join request status
  useEffect(() => {
    if (!id || !streamData || streamData.status !== 'live') return;

    const unsubscribe = subscribeToCurrentUserRequest(id, (request) => {
      setJoinRequest(request);
      
      // If request was approved, start co-host connection
      if (request?.status === 'approved' && !isCoHost) {
        handleCoHostConnect();
      }
      
      // If request was rejected or cancelled, clean up co-host connection
      if ((request?.status === 'rejected' || request?.status === 'cancelled') && isCoHost) {
        cleanupCoHostConnection();
      }
    });

    return () => unsubscribe();
  }, [id, streamData, isCoHost]);

  // Start co-host connection when approved
  const handleCoHostConnect = async () => {
    if (!id || !streamData || streamData.status !== 'live') return;
    
    try {
      setConnectionStatus('Starting co-host connection...');
      
      // Make sure we have local media
      if (!localStream) {
        await startLocalMedia();
      }
      
      if (!localStream) {
        throw new Error('Failed to get local media for co-host');
      }
      
      // Connect as co-host
      const { pc, unsubAnswer, unsubHostICE } = await connectAsCoHost(id, localStream);
      
      // Set up cleanup function
      const cleanup = () => {
        try { unsubAnswer(); } catch {}
        try { unsubHostICE(); } catch {}
        try { pc.close(); } catch {}
        try { stopLocalMedia(); } catch {}
      };
      
      setCoHostCleanup(() => cleanup);
      setIsCoHost(true);
      setConnectionStatus('Co-hosting live!');
    } catch (error) {
      console.error('Failed to connect as co-host:', error);
      setConnectionStatus('Failed to connect as co-host');
      cleanupCoHostConnection();
    }
  };
  
  // Clean up co-host connection
  const cleanupCoHostConnection = () => {
    if (coHostCleanup) {
      coHostCleanup();
      setCoHostCleanup(null);
    }
    setIsCoHost(false);
  };
  
  // ref callback to detect when the <video> is mounted
  const setVideoRef = (el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && !videoReady) setVideoReady(true);
  };

  // debug: וידאו אלמנט
  useEffect(() => {
    if (!videoRef.current) return;
    const v = videoRef.current;

  v.autoplay = true;
  v.playsInline = true;
  v.controls = true;
  // keep muted for autoplay compliance; audio can be toggled by user
  v.muted = true;

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

        // אם השידור בלייב – נשמור סטטוס ונחכה ל-effect שמוודא שהוידאו מוכן
        if (data.status === 'live' && !isConnected) {
          console.log('🔍 DEBUG connect conditions:', {
            status: data.status,
            isConnected,
            hasVideoRef: !!videoRef.current,
          });
          if (!videoRef.current) {
            setConnectionStatus('Preparing video element…');
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
      
      // Also clean up co-host connection if active
      if (coHostCleanup) {
        coHostCleanup();
      }
      
      // Clean up local media
      try { stopLocalMedia(); } catch {}
    };
  }, [id]);

  // Attempt connection once all preconditions are met
  useEffect(() => {
    if (!id) return;
    if (isConnected) return;
    if (!videoRef.current || !videoReady) return;
    if (streamData?.status !== 'live') return;
    if (connectingRef.current) return;

    const el = videoRef.current;
    connectingRef.current = true;
    setConnectionStatus('Connecting to stream…');
    connectAsViewer(id, el!)
      .then((result) => {
        console.log('✅ Connection successful:', result);
        setIsConnected(true);
        setConnectionStatus('Connected to stream');
        cleanupRef.current = result.cleanup;
      })
      .catch((err: any) => {
        console.error('❌ Failed to connect:', err);
        setError(err.message || 'Failed to connect to stream');
        setConnectionStatus('Connection failed');
      })
      .finally(() => {
        connectingRef.current = false;
      });
  }, [id, videoReady, streamData?.status, isConnected]);

  const toggleFullscreen = () => {
    const el = containerRef.current || videoRef.current;
    if (!el) return;
    const d = document as any;
    if (!document.fullscreenElement) {
      (el as any).requestFullscreen?.() || (el as any).webkitRequestFullscreen?.();
    } else {
      d.exitFullscreen?.() || d.webkitExitFullscreen?.();
    }
  };

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
        <div className="flex flex-col items-end gap-2">
          <span className="px-3 py-1 bg-red-600 text-white text-sm font-medium rounded-full">LIVE</span>
          
          {/* Request to Join Button */}
          {!isCoHost && (
            <RequestToJoinButton liveId={id!} status={streamData.status} />
          )}
          
          {/* Leave stream button for co-hosts */}
          {isCoHost && (
            <div className="mt-2">
              <LeaveLiveButton onLeave={cleanupCoHostConnection} />
            </div>
          )}
        </div>
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
        {/* Main stream container */}
        <div ref={containerRef} className="relative w-full max-w-[320px] md:max-w-[360px] lg:max-w-[400px]">
          <div className="aspect-[9/16] w-full rounded-lg overflow-hidden bg-black relative">
           <video
              ref={setVideoRef}
              autoPlay
              playsInline
              controls
              muted
              className="w-full h-full object-contain bg-black"
            />

            {/* Fullscreen toggle */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="absolute top-2 right-2 z-10 px-2 py-1 text-xs rounded bg-black/60 text-white hover:bg-black/80"
              aria-label="Toggle fullscreen"
            >
              Fullscreen
            </button>
            
            {/* Co-host badge */}
            {isCoHost && (
              <div className="absolute top-2 left-2 z-10 px-2 py-1 text-xs rounded bg-green-600 text-white">
                Co-hosting
              </div>
            )}
          </div>
        </div>

        {/* Co-host local video (only shown when co-hosting) */}
        {isCoHost && localStream && (
          <div className="relative ml-2 w-1/3 max-w-[120px]">
            <div className="aspect-[9/16] rounded-lg overflow-hidden bg-black">
              <video
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover bg-black"
                ref={(el) => {
                  if (el && localStream) {
                    el.srcObject = localStream;
                  }
                }}
              />
            </div>
            <div className="absolute bottom-1 left-1 right-1 text-center z-10 px-1 py-0.5 text-[10px] rounded bg-black/60 text-white">
              Your Camera
            </div>
          </div>
        )}
      </div>
      
      {/* Co-host status */}
      {isCoHost && (
        <div className="mt-4 mb-6 p-3 bg-green-600/20 border border-green-600 rounded-md text-center">
          <p className="text-white font-medium">You're live with the host!</p>
          <p className="text-sm text-[var(--muted)]">Your camera and microphone are being shared.</p>
        </div>
      )}

      {/* Debug Info */}
      <div className="mt-6 p-3 bg-gray-800 rounded text-xs text-gray-300">
        <div>Stream ID: {id}</div>
        <div>Status: {streamData.status}</div>
        <div>Connected: {isConnected ? 'Yes' : 'No'}</div>
        <div>Connection Status: {connectionStatus}</div>
        <div>Co-host: {isCoHost ? 'Yes' : 'No'}</div>
        <div>Join Request: {joinRequest?.status || 'None'}</div>
        <div>Video Element: {videoRef.current ? 'Ready' : 'Not Ready'}</div>
        <div>Video srcObject: {videoRef.current?.srcObject ? 'Set' : 'Not Set'}</div>
        <div>
          Video Tracks:{' '}
          {videoRef.current?.srcObject
            ? (videoRef.current.srcObject as MediaStream)?.getTracks().length || 0
            : 0}
        </div>
        <div>Local Camera: {localStream ? `Active (${localStream.getTracks().length} tracks)` : 'Not active'}</div>
      </div>
    </div>
  );
}
