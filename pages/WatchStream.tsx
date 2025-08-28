import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFirestoreInstance } from '../services/firebase';
import { connectAsViewer } from '../services/webrtcService';
import type { LiveStreamDoc } from '../services/liveStreams';
import { normalizeLiveDoc } from '../utils/liveDoc';
import UserAvatar from '../components/UserAvatar';
import RequestToJoinButton from '../components/cohost/RequestToJoinButton';
import '../styles/cohost.css';
import '../styles/components/watch-video.css';

export default function WatchStream() {
  const { id } = useParams<{ id: string }>();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [stageMode, setStageMode] = useState<'portrait' | 'landscape' | 'square'>('portrait');
  const [videoReady, setVideoReady] = useState(false);
  const [streamData, setStreamData] = useState<LiveStreamDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('Waiting for stream...');
  const [muted, setMuted] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(true);
  const cleanupRef = useRef<(() => void) | null>(null);
  const connectingRef = useRef(false);

  // ref callback to detect when the <video> is mounted
  const setVideoRef = (el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && !videoReady) {
      // הגדרת מאפיין data-source לזיהוי סוג המקור (יעודכן בהמשך לפי המידע מהסטרים)
      el.setAttribute('data-source', 'default');
      setVideoReady(true);
    }
  };

  // פונקציה לזיהוי מקור הסטרים (מובייל או אחר) ועדכון הסגנון בהתאם
  const detectStreamSource = (videoElement: HTMLVideoElement) => {
    if (!videoElement) return;
    
    console.log('🔍 בודק מקור הסטרים לפי פרופורציות');
    
    // המתן עד שיש מידע על גודל הוידאו
    const checkVideoSize = () => {
      const { videoWidth, videoHeight } = videoElement;
      
      if (videoWidth && videoHeight) {
        const ratio = videoWidth / videoHeight;
        console.log(`📏 יחס וידאו: ${ratio.toFixed(3)} (${videoWidth}x${videoHeight})`);

        // Thresholds per requirement: >=1.2 landscape, <=0.9 portrait (mobile), else square-ish
        if (ratio >= 1.2) {
          videoElement.setAttribute('data-source', 'landscape');
          setStageMode('landscape');
          console.log('🖥️ מקור: landscape');
        } else if (ratio <= 0.9) {
          videoElement.setAttribute('data-source', 'mobile');
          setStageMode('portrait');
          console.log('📱 מקור: portrait/mobile');
        } else {
          videoElement.setAttribute('data-source', 'square');
          setStageMode('square');
          console.log('◼️ מקור: square-ish');
        }
      }
    };
    
    // בדיקה מיידית וגם לאחר טעינת מידע
    checkVideoSize();
    videoElement.addEventListener('loadedmetadata', checkVideoSize);
  };
  
  // video element: initialize autoplay/inline and tag aspect on metadata
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.autoplay = true;
    v.playsInline = true;
    v.controls = false;
  v.muted = false;
    v.onloadedmetadata = () => {
  console.log('🎥 loadedmetadata', { w: v.videoWidth, h: v.videoHeight, duration: v.duration, elSize: `${v.clientWidth}x${v.clientHeight}` });
      detectStreamSource(v);
      v.play().then(() => setNeedsGesture(false)).catch(() => setNeedsGesture(true));
    };
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

  let data = snap.data() as LiveStreamDoc;
  data = normalizeLiveDoc(data);
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
        
        // זיהוי מקור השידור (מובייל או אחר) לאחר חיבור מוצלח
        if (el) {
          // המתן לפרטי הוידאו ועדכן את הסגנון בהתאם
          const checkSourceType = () => {
            if (el.videoWidth && el.videoHeight) {
              detectStreamSource(el);
            } else {
              // נסה שוב אם עדיין אין נתוני גודל
              setTimeout(checkSourceType, 500);
            }
          };
          
          // המתן מעט לפני בדיקת הגודל כדי לאפשר קבלת מידע
          setTimeout(checkSourceType, 1000);
          // אם הווידאו במצב מושהה אחרי החיבור – נציג שכבת הפעלה
          setTimeout(() => {
            if (el.paused) setNeedsGesture(true); else setNeedsGesture(false);
          }, 800);
        }
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

  // Removed aggressive black-screen refresh loop; rely on stable attach and CSS

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
        <div ref={containerRef} className="ws-watch">
          <div className="video-stage" data-mode={stageMode}>
            {/* LIVE badge (kept minimal) */}
            <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 3, background: 'red', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>LIVE</div>

            {/* Video element */}
            <video
              ref={setVideoRef}
              autoPlay
              playsInline
              className="video-el"
              data-source="default"
              onPlay={() => setNeedsGesture(false)}
              onPause={() => setNeedsGesture(true)}
            />

            {/* Title overlay */}
            {streamData && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', padding: 16, background: 'linear-gradient(transparent, rgba(0,0,0,0.35) 70%)', color: '#fff', zIndex: 2 }}>
                <div>
                  <div className="text-lg font-bold">{streamData.title}</div>
                  <div className="text-sm opacity-80">{streamData.displayName}</div>
                </div>
              </div>
            )}
          </div>

          {/* Tap-to-play overlay */}
          {needsGesture && (
            <button
              type="button"
              onClick={() => {
                const v = videoRef.current; if (!v) return;
                v.muted = false; setMuted(false);
                // Attempt to start hidden audio element too
                try { const au = document.getElementById(`viewer-audio-${id}`) as HTMLAudioElement | null; if (au) { (au as any).muted = false; au.play().catch(() => {}); } } catch {}
                v.play().then(() => setNeedsGesture(false)).catch(() => setNeedsGesture(true));
              }}
              style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(transparent, rgba(0,0,0,0.35))' }}
              aria-label="הפעל עם שמע"
            >
              <span style={{ background: 'rgba(0,0,0,0.55)', color: '#fff', padding: '10px 14px', borderRadius: 9999, fontWeight: 700 }}>הקש כדי להפעיל עם שמע</span>
            </button>
          )}

          {/* Actions rail */}
          <div style={{ position: 'absolute', right: 12, bottom: 80, zIndex: 4, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* כפתור מסך מלא */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="flex flex-col items-center"
              aria-label="מסך מלא"
            >
              <div className="w-12 h-12 flex items-center justify-center bg-black/50 rounded-full backdrop-blur-sm mb-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                </svg>
              </div>
              <span className="text-white text-xs">מסך מלא</span>
            </button>
            {/* mute/unmute toggle */}
            <button
              type="button"
              onClick={() => {
                const v = videoRef.current; if (!v) return; v.muted = !v.muted; setMuted(v.muted);
                const au = document.getElementById(`viewer-audio-${id}`) as HTMLAudioElement | null; if (au) { try { (au as any).muted = v.muted; } catch {} }
                // if unmuting requires a user gesture, this click is the gesture
                if (!v.muted) v.play().catch(() => {});
              }}
              className="flex flex-col items-center"
              aria-label={muted ? 'בטל השתקה' : 'השתקה'}
            >
              <div className="w-12 h-12 flex items-center justify-center bg-black/50 rounded-full backdrop-blur-sm mb-1">
                {muted ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 9v6l-4-4h-2v-2h2l4-4z" />
                    <path d="M15 9l6 6" /><path d="M21 9l-6 6" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 9v6l-4-4h-2v-2h2l4-4z" />
                    <path d="M15 9a5 5 0 0 1 0 6" />
                    <path d="M18 6a9 9 0 0 1 0 12" />
                  </svg>
                )}
              </div>
              <span className="text-white text-xs">{muted ? 'בטל השתקה' : 'השתקה'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Co-host request */}
      {id && (
        <div className="flex justify-center mb-8">
          <RequestToJoinButton liveId={id!} />
        </div>
      )}

      {/* Debug Info */}
      <div className="mt-6 p-3 bg-gray-800 rounded text-xs text-gray-300">
        <div>Stream ID: {id}</div>
        <div>Status: {streamData?.status}</div>
        <div>Connected: {isConnected ? 'Yes' : 'No'}</div>
        <div>Connection Status: {connectionStatus}</div>
        <div>Video Element: {videoRef.current ? 'Ready' : 'Not Ready'}</div>
        <div>Video srcObject: {videoRef.current?.srcObject ? 'Set' : 'Not Set'}</div>
        <div>
          Video Tracks:{' '}
          {videoRef.current?.srcObject
            ? (videoRef.current?.srcObject as MediaStream)?.getTracks().length || 0
            : 0}
        </div>
      </div>
    </div>
  );
}
