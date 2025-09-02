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
      
      // Get local media stream
      let mediaStream = localStream;
      
      // Make sure we have local media
      if (!mediaStream) {
        console.log('🎥 Starting local media for co-host connection...');
        try {
          mediaStream = await startLocalMedia();
          console.log('✅ Local media started successfully');
          
          // Wait a bit to ensure stream is fully initialized
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (mediaError: any) {
          console.error('❌ Failed to get camera/microphone access:', mediaError);
          setConnectionStatus(`Failed to access camera/microphone: ${mediaError.message || 'Permission denied'}`);
          return;
        }
      }
      
      // Wait for local stream to be actually available
      let attempts = 0;
      const maxAttempts = 5;
      while (!mediaStream && attempts < maxAttempts) {
        console.log(`⏳ Waiting for local stream to be ready... (attempt ${attempts + 1}/${maxAttempts})`);
        mediaStream = localStream; // Try to get from state again
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
      
      if (!mediaStream) {
        console.error('❌ Local stream is still null after waiting');
        throw new Error('Failed to get local media for co-host - stream is null');
      }
      
      // Log track information to debug
      const trackInfo = mediaStream.getTracks().map(t => ({
        kind: t.kind,
        enabled: t.enabled,
        muted: t.muted,
        readyState: t.readyState,
        id: t.id
      }));
      
      console.log('🎥 Local media ready with tracks:', trackInfo);
      
      if (trackInfo.length === 0) {
        console.error('❌ No tracks in local stream');
        throw new Error('No camera/microphone tracks available');
      }
      
      // Show connecting indicator
      setConnectionStatus('Connecting to host as co-host...');
      
      // Add timeout to abort if taking too long
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout - taking too long to connect')), 60000);
      });
      
      // Check if the video element is available
      if (!videoRef.current) {
        console.error('❌ Video element is not available for co-host connection');
        throw new Error('Video element not ready');
      }
      
      console.log('📡 Attempting to connect as co-host with stream tracks:', 
        mediaStream.getTracks().map(t => `${t.kind} (${t.readyState})`).join(', '));
      
      // Connect as co-host with timeout
      const connectPromise = connectAsCoHost(id, mediaStream, videoRef.current);
      
      // Make sure the audio is unmuted in the local stream
      mediaStream.getAudioTracks().forEach(track => {
        track.enabled = true;
      });
      
      // Make sure the video is enabled in the local stream
      mediaStream.getVideoTracks().forEach(track => {
        track.enabled = true;
      });
      
      // First, check if stream is still live
      try {
        const { getFirestoreInstance } = await import('../services/firebase');
        const { doc, getDoc, updateDoc } = await import('firebase/firestore');
        const db = getFirestoreInstance();
        
        // Verify stream is still live before attempting to connect
        const streamRef = doc(db, 'liveStreams', id);
        const streamSnap = await getDoc(streamRef);
        
        if (!streamSnap.exists()) {
          throw new Error('Stream not found');
        }
        
        const streamData = streamSnap.data();
        if (streamData.status !== 'live') {
          console.warn(`⚠️ Stream status is ${streamData.status}, attempting to fix...`);
          
          // Try to refresh stream status if it's incorrectly marked as ended
          try {
            await updateDoc(streamRef, {
              status: 'live',
              lastSeen: new Date(),
              reconnectedAt: new Date().toISOString()
            });
            console.log('✅ Fixed stream status back to live');
          } catch (err) {
            console.error('❌ Could not update stream status:', err);
            // Continue anyway, the connection might still work
          }
        }
      } catch (err) {
        console.warn('⚠️ Error checking stream status:', err);
        // Continue anyway, the connection might still work
      }

      // Race between connection and timeout
      const { pc, unsubAnswer, unsubHostICE } = await Promise.race([
        connectPromise,
        timeoutPromise as Promise<any>
      ]);
      
      console.log('✅ Successfully connected as co-host!');
      
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
      
      // IMPORTANT: Preserve the existing host video connection
      if (videoRef.current) {
        // Unmute the host video so we can hear them
        videoRef.current.muted = false;
        
        // Make sure we don't lose the existing host video connection
        const hostVideo = document.getElementById('hostVideo') as HTMLVideoElement;
        if (hostVideo) {
          console.log('🔄 Ensuring host video continues to play');
          // Don't reset srcObject as that breaks the connection
          
          // Just ensure it's playing and unmuted
          hostVideo.muted = false;
          if (hostVideo.paused) {
            hostVideo.play().catch(e => console.warn('⚠️ Host video play error:', e));
          }
          
          // Apply any necessary styles to ensure visibility
          hostVideo.style.display = 'block';
          hostVideo.style.opacity = '1';
        }
      }
      
      // Make sure local video is displayed properly
      const localVideo = document.getElementById('localVideo') as HTMLVideoElement;
      if (localVideo && mediaStream) {
        console.log('🔄 Ensuring local video is displayed');
        localVideo.srcObject = mediaStream;
        localVideo.play().catch(e => console.warn('⚠️ Local video play error:', e));
      }
      
      // Add connection state monitoring
      pc.onconnectionstatechange = () => {
        console.log(`🔄 Co-host connection state changed: ${pc.connectionState}`);
        if (pc.connectionState === 'connected') {
          setConnectionStatus('Connected to host - Live!');
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setConnectionStatus(`Connection ${pc.connectionState}. Try refreshing.`);
        }
      };
    } catch (error: any) {
      console.error('Failed to connect as co-host:', error);
      
      // Provide more helpful error messages
      let errorMessage = 'Failed to connect as co-host';
      
      if (error.message?.includes('Timeout waiting for host answer')) {
        errorMessage = 'Host did not respond to your join request. They may be busy or offline.';
      } else if (error.message?.includes('access')) {
        errorMessage = 'Camera/microphone access denied. Check your browser permissions.';
      } else if (error.message?.includes('Connection timeout')) {
        errorMessage = 'Connection timed out. The host may be offline or having network issues.';
      }
      
      setConnectionStatus(errorMessage);
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

  // Effect to handle videos when in co-host mode
  useEffect(() => {
    if (isCoHost) {
      // Run checks at multiple intervals to ensure videos stay working
      const checkTimes = [100, 500, 1000, 2000, 5000];
      
      checkTimes.forEach(delay => {
        setTimeout(() => {
          // Unmute and refresh host video
          const hostVideo = document.getElementById('hostVideo') as HTMLVideoElement;
          if (hostVideo) {
            console.log(`🔊 Setting up host video for co-host mode (${delay}ms check)`);
            hostVideo.muted = false;
            
            // Force visible
            hostVideo.style.opacity = '1';
            hostVideo.style.display = 'block';
            
            // Check if the stream exists, if not and we have our saved stream, use that
          if (!hostVideo.srcObject && originalStreamRef.current) {
            console.log('🔄 Restoring host video stream from saved reference');
            hostVideo.srcObject = originalStreamRef.current;
          }            // If the video is paused or frozen, try to play it
            if (hostVideo.paused || hostVideo.readyState < 3) {
              hostVideo.play().catch(err => {
                console.warn(`⚠️ Could not play host video in co-host mode (${delay}ms check):`, err);
              });
            }
          }
          
          // Make sure local video is displayed
          const localVideo = document.getElementById('localVideo') as HTMLVideoElement;
          if (localVideo && localStream) {
            console.log(`🔊 Setting up local video for co-host mode (${delay}ms check)`);
            localVideo.srcObject = localStream;
            localVideo.play().catch(err => {
              console.warn(`⚠️ Could not play local video in co-host mode (${delay}ms check):`, err);
            });
          }
        }, delay);
      });
    }
  }, [isCoHost, localStream]);

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

  // Save the original stream when first connected - we'll use this to restore if needed
  const originalStreamRef = useRef<MediaStream | null>(null);

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
    
    // Make sure video element is properly set up
    if (el) {
      el.autoplay = true;
      el.playsInline = true;
    }
    
    connectAsViewer(id, el!)
      .then((result) => {
        console.log('✅ Connection successful:', result);
        setIsConnected(true);
        setConnectionStatus('Connected to stream');
        cleanupRef.current = result.cleanup;
        
        // Save the original stream for potential restoration later
        if (el && el.srcObject instanceof MediaStream) {
          originalStreamRef.current = el.srcObject;
          console.log('💾 Saved original host stream for later restoration if needed');
        }
        
        // Force play the video to ensure it's not frozen
        if (el && el.paused) {
          console.log('▶️ Forcing host video playback');
          el.play().catch(err => {
            console.warn('⚠️ Could not force play host video:', err);
          });
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
  
  // Effect to restore host video if it gets lost during co-host connection
  useEffect(() => {
    // Only run if we're co-hosting AND we have a saved original stream
    if (isCoHost && originalStreamRef.current && videoRef.current) {
      const checkHostVideo = () => {
        const hostVideo = document.getElementById('hostVideo') as HTMLVideoElement;
        if (hostVideo && (!hostVideo.srcObject || 
            hostVideo.srcObject instanceof MediaStream && 
            (hostVideo.srcObject as MediaStream).getTracks().length === 0)) {
          
          console.log('🔄 Host video stream lost after co-host connection - restoring from saved stream');
          hostVideo.srcObject = originalStreamRef.current;
          hostVideo.muted = false;
          hostVideo.play().catch(e => console.warn('⚠️ Error playing restored host video:', e));
        }
      };
      
      // Check immediately and after a short delay to ensure it's caught
      checkHostVideo();
      const timeoutId = setTimeout(checkHostVideo, 2000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [isCoHost]);

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
        {/* Video grid layout - changes based on co-hosting status */}
        <div className={`grid ${isCoHost ? 'grid-cols-2 gap-4 w-full max-w-[1200px]' : 'grid-cols-1 w-full max-w-[600px]'}`}>
          {/* Host Stream */}
          <div ref={containerRef} className="relative">
            <div className="aspect-video w-full rounded-lg overflow-hidden bg-black relative border-2 border-blue-300 shadow-lg">
              <video
                id="hostVideo"
                ref={setVideoRef}
                autoPlay
                playsInline
                controls
                muted={!isCoHost} // Only mute if not in co-host mode
                className="w-full h-full object-contain bg-black"
                style={{ objectFit: 'contain' }}
                onLoadedMetadata={(e) => {
                  console.log('📊 Host video metadata loaded:', {
                    width: e.currentTarget.videoWidth,
                    height: e.currentTarget.videoHeight
                  });
                }}
                onPlay={() => {
                  console.log('▶️ Host video is now playing');
                }}
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
              
              {/* Host badge */}
              <div className="absolute top-2 left-2 z-10 px-3 py-1 text-xs rounded-full bg-gradient-to-r from-blue-600 to-blue-400 text-white font-bold shadow-sm">
                Host
              </div>
            </div>
          </div>

          {/* Co-host mode - show your own stream */}
          {isCoHost && (
            <div className="relative">
              <div className="aspect-video w-full rounded-lg overflow-hidden bg-black border-2 border-green-300 shadow-lg">
                <video
                  id="localVideo"
                  autoPlay
                  playsInline
                  controls
                  className="w-full h-full object-contain bg-black"
                  ref={(el) => {
                    if (el && localStream) {
                      console.log('📹 Setting local stream to video element');
                      // Make sure we're using a fresh stream object
                      el.srcObject = null;
                      el.srcObject = localStream;
                      
                      // Try to play the video
                      el.play().catch(err => {
                        console.warn('⚠️ Could not autoplay local video:', err);
                        
                        // Try again after a short delay
                        setTimeout(() => {
                          if (el.srcObject) {
                            el.play().catch(delayedErr => {
                              console.warn('⚠️ Still could not autoplay local video after delay:', delayedErr);
                            });
                          }
                        }, 1000);
                      });
                      
                      // Log when video is actually playing
                      el.onplaying = () => {
                        console.log('▶️ Local video is now playing');
                      };
                      
                      // Log metadata when loaded
                      el.onloadedmetadata = () => {
                        console.log('📊 Local video metadata loaded:', {
                          width: el.videoWidth,
                          height: el.videoHeight
                        });
                      };
                    }
                  }}
                />
                
                {/* Co-host badge */}
                <div className="absolute top-2 left-2 z-10 px-3 py-1 text-xs rounded-full bg-gradient-to-r from-green-600 to-green-400 text-white font-bold shadow-sm">
                  You (Co-host)
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Co-host status */}
      {isCoHost && (
        <div className="mt-4 mb-6 p-3 bg-green-600/20 border border-green-600 rounded-md text-center">
          <p className="text-white font-medium">You're live with the host!</p>
          <p className="text-sm text-[var(--muted)]">Your camera and microphone are being shared.</p>
        </div>
      )}
      
      {/* Join request status */}
      {joinRequest && joinRequest.status === 'pending' && (
        <div className="mt-4 mb-6 p-3 bg-yellow-600/20 border border-yellow-600 rounded-md text-center">
          <p className="text-white font-medium">Your request to join is pending</p>
          <p className="text-sm text-[var(--muted)]">Waiting for the host to approve your request...</p>
        </div>
      )}
      
      {joinRequest && joinRequest.status === 'rejected' && (
        <div className="mt-4 mb-6 p-3 bg-red-600/20 border border-red-600 rounded-md text-center">
          <p className="text-white font-medium">Your request to join was declined</p>
          <p className="text-sm text-[var(--muted)]">The host has declined your request to join.</p>
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
