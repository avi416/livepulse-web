import { useEffect, useRef, useState } from "react";
import { createBroadcasterPC, hostAcceptCoHost } from "../services/webrtcService";
import { endLiveStream, heartbeatLiveStream, startLiveStream, getStreamById } from "../services/streamService";
import { RequestsPanel, HostCohostController, StopLiveButton, LiveGrid, DebugPanel } from "./cohost";
import type { CoHostConnection } from "../types/cohost";
import { useCoHostMixer } from "../hooks/useCoHostMixer";

// Feature flag for mixer (can be moved to env variable)
const ENABLE_MIXER = false;

export default function LiveStream() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [cohosts, setCohosts] = useState<CoHostConnection[]>([]);
  const [coHostConnections, setCoHostConnections] = useState<Map<string, any>>(new Map());
  const broadcasterRef = useRef<null | { pc: RTCPeerConnection; unsubAnswer?: () => void; unsubViewerICE?: () => void; stream?: MediaStream }>(null);
  
  // Manual force debug value - always true to show panel
  const isHost = true;

  // Initialize the mixer (if enabled)
  const { addCoHostStream, removeCoHostStream } = useCoHostMixer({
    hostStream: broadcasterRef.current?.stream || null,
    enabled: ENABLE_MIXER
  });

  // Fetch live stream data
  useEffect(() => {
    if (!streamId) return;
    
    const fetchLiveDoc = async () => {
      try {
        const doc = await getStreamById(streamId);
        console.log('🎯 Live doc fetched:', doc);
        
        // Important debug
        console.log('⚠️ DEBUG: Setting liveDoc - This confirms we have stream data');
      } catch (error) {
        console.error('❌ Failed to fetch live doc:', error);
      }
    };
    
    fetchLiveDoc();
  }, [streamId]);

  const startLive = async () => {
    try {
      console.log("🎥 Requesting camera + mic...");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

      if (!stream) {
        throw new Error("No MediaStream received from getUserMedia");
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // צור רשומת liveStreams בפיירסטור
      const id = await startLiveStream("My Live Stream");
      setStreamId(id);

  console.log("📡 Creating Broadcaster PC with stream:", stream);
  const res = await createBroadcasterPC(stream, id);
  broadcasterRef.current = { ...res, stream } as any;

      setIsLive(true);
    } catch (err) {
      console.error("❌ Failed to start broadcast:", err);
      alert("לא ניתן להפעיל מצלמה/מיקרופון או להתחיל שידור");
    }
  };

  const endLive = async () => {
    if (!streamId) return;
    console.log("🛑 Ending live:", streamId);
    try {
      // Stop local tracks
      const stream = (broadcasterRef.current as any)?.stream as MediaStream | undefined;
      stream?.getTracks().forEach((t) => {
        try { t.stop(); } catch {}
      });
      // Close PC and unsubscribe
      try { broadcasterRef.current?.unsubAnswer?.(); } catch {}
      try { broadcasterRef.current?.unsubViewerICE?.(); } catch {}
      try { broadcasterRef.current?.pc?.close(); } catch {}
      broadcasterRef.current = null;

      // Clean up co-host connections
      cohosts.forEach(cohost => {
        removeCoHost(cohost.uid);
      });

      // Mark as ended in Firestore
      await endLiveStream(streamId);
    } catch (e) {
      console.warn("⚠️ Failed to end live cleanly:", e);
    } finally {
      setIsLive(false);
    }
  };

  // Handle co-host approval
  const handleCoHostApproval = async (uid: string) => {
    if (!streamId || !broadcasterRef.current?.stream) {
      console.error("❌ Cannot accept co-host: missing streamId or broadcaster stream");
      return;
    }
    
    // Import needed Firebase modules
    const { getFirestoreInstance } = await import('../services/firebase');
    const { doc, collection, getDoc, setDoc, updateDoc } = await import('firebase/firestore');
    const db = getFirestoreInstance();
    
    try {
      console.log(`🤝 Host accepting co-host: ${uid}`);
      
      // Send a heartbeat immediately to ensure stream stays alive
      try {
        console.log("💓 Sending immediate heartbeat before accepting co-host...");
        await heartbeatLiveStream(streamId);
        console.log("✅ Pre-cohost heartbeat sent successfully");
      } catch (err) {
        console.error("❌ Pre-cohost heartbeat failed:", err);
        // Continue anyway, we'll try to recover
      }
      
      // Create a video element for the co-host with specific styling for better visibility
      const coHostVideoElement = document.createElement('video');
      coHostVideoElement.autoplay = true;
      coHostVideoElement.playsInline = true;
      coHostVideoElement.controls = true;
      coHostVideoElement.muted = false; // Not muted by default
      coHostVideoElement.style.objectFit = 'contain';
      coHostVideoElement.style.width = '100%';
      coHostVideoElement.style.height = '100%';
      coHostVideoElement.style.backgroundColor = 'black';
      
      // Check if there's a pending co-host request
      const liveStreamDoc = doc(db, 'liveStreams', streamId);
      const cohostDoc = doc(collection(liveStreamDoc, 'cohost'), uid);
      
      // Force the stream status to 'live' before proceeding
      try {
        await updateDoc(liveStreamDoc, {
          status: 'live',
          lastSeen: new Date(),
          hasCoHost: true // Add a flag indicating this stream has a co-host
        });
        console.log("✅ Stream status refreshed to 'live' with co-host flag");
      } catch (err) {
        console.error("❌ Failed to refresh stream status:", err);
        // Continue anyway
      }
      
      // Update co-host document to indicate host is preparing to connect
      try {
        await setDoc(cohostDoc, { 
          hostPreparing: true,
          hostAcceptedAt: new Date().toISOString(),
          streamId: streamId,
          // Include stream status information
          streamStatus: 'live'
        }, { merge: true });
        console.log('✅ Updated co-host document to indicate host is preparing');
      } catch (err) {
        console.warn('⚠️ Could not update co-host document:', err);
        // Continue anyway as this is just a notification
      }
      
      // Check if the co-host is waiting
      try {
        const cohostData = await getDoc(cohostDoc);
        if (cohostData.exists()) {
          console.log('✅ Found co-host request data:', cohostData.data());
          
          // If the co-host isn't waiting anymore, abort
          if (cohostData.data().waitingForAnswer === false) {
            console.warn('⚠️ Co-host is no longer waiting for answer, aborting connection');
            return;
          }
        } else {
          console.warn('⚠️ No co-host request data found, but continuing anyway');
        }
      } catch (err) {
        console.error('❌ Error checking co-host request:', err);
        // Continue anyway as this is just a check
      }
      
      // Get co-host display name from their join request BEFORE initiating connection
      let displayName = uid.substring(0, 6); // Default to truncated UID
      let photoURL = null;
      
      try {
        // Try to fetch the request to get the display name
        const requestsRef = collection(db, 'liveStreams', streamId, 'requests');
        const requestSnapshot = await getDoc(doc(requestsRef, uid));
        if (requestSnapshot.exists()) {
          const data = requestSnapshot.data();
          displayName = data.displayName || displayName;
          photoURL = data.photoURL || null;
          console.log(`📛 Found co-host display name: ${displayName}`);
        }
      } catch (err) {
        console.warn('⚠️ Could not fetch co-host display name:', err);
      }
      
      // Accept the co-host connection
      console.log(`🔄 Initiating connection with co-host ${uid}...`);
      
      // Set a timeout to abort if taking too long
      const connectionPromise = hostAcceptCoHost(
        streamId as string,
        broadcasterRef.current.stream as MediaStream,
        coHostVideoElement,
        uid
      );
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout - taking too long to connect to co-host')), 60000);
      });
      
      const { pc, cleanup } = await Promise.race([
        connectionPromise,
        timeoutPromise as Promise<any>
      ]);
      
      console.log(`✅ Connection established with co-host ${uid}`);
      
      // Add a callback for remote tracks
      pc.ontrack = (event: RTCTrackEvent) => {
        const stream = event.streams[0];
        console.log(`📡 Received co-host stream from ${uid}`, {
          stream: stream ? "valid stream" : "missing stream",
          tracks: stream?.getTracks().map((t: MediaStreamTrack) => ({ kind: t.kind, enabled: t.enabled, muted: t.muted })) || []
        });
        
        // Verify that we've received valid tracks
        if (!stream || stream.getTracks().length === 0) {
          console.warn("⚠️ Received empty or invalid stream from co-host");
        }
        
        // Add to mixer if enabled
        if (ENABLE_MIXER) {
          addCoHostStream(uid, stream);
        }
        
        // Create new stream object to ensure it's properly handled
        const cohostStream = new MediaStream();
        stream.getTracks().forEach((track: MediaStreamTrack) => {
          cohostStream.addTrack(track);
        });
        
        // Update co-hosts state with the new stream
        setCohosts(prev => {
          const newCohosts = [
            ...prev.filter(c => c.uid !== uid),
            { 
              uid: uid, 
              displayName: displayName, 
              photoURL: photoURL,
              peerConnection: pc, 
              stream: cohostStream, 
              isMuted: false 
            }
          ];
          console.log(`✅ Updated cohosts list: ${newCohosts.length} co-hosts`, 
            newCohosts.map(c => ({ 
              uid: c.uid, 
              displayName: c.displayName,
              hasStream: !!c.stream, 
              trackCount: c.stream?.getTracks().length || 0
            }))
          );
          return newCohosts;
        });
        
        // Force UI refresh
        setTimeout(() => {
          console.log("🔄 Forcing UI refresh for co-host display");
          setCohosts(current => [...current]);
        }, 500);
      };
      
      // Add connection state monitoring
      pc.onconnectionstatechange = () => {
        console.log(`🔄 Host-CoHost connection state changed: ${pc.connectionState}`);
        
        // If disconnected, update UI
        if (pc.connectionState === 'disconnected' || 
            pc.connectionState === 'failed' || 
            pc.connectionState === 'closed') {
          console.log(`⚠️ Co-host ${uid} connection ended: ${pc.connectionState}`);
          
          // Remove co-host from the list after a brief delay
          setTimeout(() => {
            removeCoHost(uid);
          }, 1000);
        }
      };
      
      // Store the connection for later cleanup
      setCoHostConnections(prev => {
        const updated = new Map(prev);
        updated.set(uid, { pc, cleanup });
        console.log(`✅ Stored connection for co-host ${uid} in map`);
        return updated;
      });
    } catch (error) {
      console.error(`❌ Failed to accept co-host ${uid}:`, error);
      
      // Notify co-host about the error
      try {
        const liveStreamDoc = doc(db, 'liveStreams', streamId);
        const cohostDoc = doc(collection(liveStreamDoc, 'cohost'), uid);
        
        await setDoc(cohostDoc, { 
          hostError: `Failed to establish connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
          errorTimestamp: new Date().toISOString()
        }, { merge: true });
        
        console.log('✅ Error status updated for co-host');
      } catch (updateErr) {
        console.error('❌ Could not update error status:', updateErr);
      }
    }
  };

  // Remove a co-host
  const removeCoHost = (uid: string) => {
    const connection = coHostConnections.get(uid);
    if (connection) {
      try {
        // Clean up the WebRTC connection
        connection.cleanup();
        
        // Remove from mixer if enabled
        if (ENABLE_MIXER) {
          removeCoHostStream(uid);
        }
        
        // Update connections state
        setCoHostConnections(prev => {
          const updated = new Map(prev);
          updated.delete(uid);
          return updated;
        });
        
        // Update co-hosts state
        setCohosts(prev => prev.filter(c => c.uid !== uid));
        
        console.log(`👋 Removed co-host: ${uid}`);
      } catch (error) {
        console.error(`❌ Failed to remove co-host ${uid}:`, error);
      }
    }
  };

  // Toggle mute for a co-host
  const toggleCoHostMute = (uid: string, mute: boolean) => {
    setCohosts(prev => 
      prev.map(c => c.uid === uid ? { ...c, isMuted: mute } : c)
    );
    
    // Find the co-host and mute their audio tracks
    const cohost = cohosts.find(c => c.uid === uid);
    if (cohost && cohost.stream) {
      cohost.stream.getAudioTracks().forEach(track => {
        track.enabled = !mute;
      });
    }
  };

  // Manage heartbeat and cleanup when navigating away
  useEffect(() => {
    let hb: number | null = null;
    // heartbeat while live - occurs more frequently (every 5 seconds) to ensure stability
    if (isLive && streamId) {
      console.log("🔄 Starting heartbeat for stream:", streamId);
      
      // Send an immediate heartbeat when starting
      console.log("💓 Sending immediate initial heartbeat...");
      heartbeatLiveStream(streamId)
        .then(() => console.log("✅ Initial heartbeat sent successfully"))
        .catch((err) => console.error("❌ Initial heartbeat failed:", err));
      
      // Regular interval heartbeat
      hb = window.setInterval(() => {
        console.log("💓 Sending heartbeat...");
        heartbeatLiveStream(streamId)
          .then(() => console.log("✅ Heartbeat sent successfully"))
          .catch((err) => {
            console.error("❌ Heartbeat failed:", err);
            // Recovery attempt - try one more time after a short delay
            setTimeout(() => {
              console.log("🔄 Attempting recovery heartbeat...");
              heartbeatLiveStream(streamId).catch(e => 
                console.error("❌ Recovery heartbeat also failed:", e)
              );
            }, 1000);
          });
      }, 5_000); // Reduced to 5 seconds for more reliable stream status
    }
    
    const handleBeforeUnload = () => {
      // Fire-and-forget; may not always complete but helps
      if (isLive && streamId) {
        try { navigator.sendBeacon && navigator.sendBeacon("/noop"); } catch {}
        // Best-effort: not guaranteed to finish
        endLiveStream(streamId).catch(() => {});
      }
    };
    
    // REMOVED: The visibility change handler that was ending streams when tab lost focus
    // Now we just log visibility changes but don't end the stream
    const handleVisibility = () => {
      if (document.hidden) {
        console.log("📱 Tab hidden, stream continuing in background");
      } else {
        console.log("👁️ Tab visible again");
        // Optionally send an immediate heartbeat when tab becomes visible again
        if (isLive && streamId) {
          heartbeatLiveStream(streamId).catch(() => {});
        }
      }
    };
    
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibility);
    
    return () => {
      if (hb) {
        console.log("🛑 Stopping heartbeat interval");
        try { window.clearInterval(hb); } catch {}
      }
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibility);
      
      // Component unmount cleanup
      if (isLive) {
        if (streamId) {
          console.log("🧹 Cleanup: Ending stream on component unmount");
          endLiveStream(streamId).catch(() => {});
        }
        const stream = (broadcasterRef.current as any)?.stream as MediaStream | undefined;
        stream?.getTracks().forEach((t) => { try { t.stop(); } catch {} });
        try { broadcasterRef.current?.pc?.close(); } catch {}
        
        // Clean up co-host connections
        cohosts.forEach(cohost => {
          try {
            const connection = coHostConnections.get(cohost.uid);
            if (connection) connection.cleanup();
          } catch {}
        });
      }
    };
  }, [isLive, streamId, cohosts, coHostConnections]);

  // Debug current state and co-host changes
  useEffect(() => {
    if (isLive && streamId) {
      console.log("🚨 DEBUG LiveStream Component State:");
      console.log("- isLive:", isLive);
      console.log("- streamId:", streamId);
      console.log("- isHost:", isHost);
      console.log("- cohosts count:", cohosts.length);
      
      // Debug co-host details
      if (cohosts.length > 0) {
        cohosts.forEach((ch, idx) => {
          console.log(`Co-host ${idx + 1}:`, {
            uid: ch.uid,
            hasStream: !!ch.stream,
            streamTracks: ch.stream?.getTracks().map(t => ({
              kind: t.kind,
              enabled: t.enabled,
              muted: t.muted
            })) || [],
            isMuted: ch.isMuted
          });
        });
      }
    }
  }, [isLive, streamId, isHost, cohosts]);

  return (
    <div className={`flex flex-col items-center justify-center min-h-screen bg-white text-gray-800 p-4 ${
      cohosts.length > 0 ? 'w-full max-w-full' : ''
    }`}>
      <h1 className="text-2xl font-bold mb-6">🎥 Live Stream</h1>

      {/* Use the LiveGrid component to display host and co-host videos side by side */}
      <div className={`${
        cohosts.length > 0 ? 'w-[1200px]' : 'w-[600px]'
      } max-w-full transition-all duration-300`}>
        <LiveGrid 
          hostVideoRef={videoRef}
          cohosts={cohosts}
        />
      </div>

      {!isLive ? (
        <button
          onClick={startLive}
          className="mt-6 px-6 py-3 bg-blue-500 text-white rounded-lg text-lg hover:bg-blue-600 shadow-md transition-colors"
        >
          Start Live
        </button>
      ) : (
        <div className="mt-6 flex flex-col w-full max-w-[600px]">
          <StopLiveButton liveId={streamId!} onEnded={endLive} />
          
          {/* CO-HOST CONTROLS - Using isHost here */}
          {isLive && streamId && isHost && (
            <div className="mt-6 p-4 border-2 border-blue-300 bg-white rounded-lg shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">Host Controls</h3>
                <div className="px-3 py-1 bg-blue-500 text-white rounded-full text-sm">
                  Host Mode
                </div>
              </div>
              
              <div className="mb-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg shadow-lg">
                <p className="text-blue-700 font-bold text-lg flex items-center">
                  <span className="text-2xl mr-2">⚠️</span> לתשומת לבך: פאנל אישור הצטרפות לשידור
                </p>
                <p className="text-gray-700 mt-2">כאן תוכל לראות בקשות הצטרפות לשידור ולאשר אותן</p>
                <p className="text-blue-500 text-sm mt-2 font-mono">Stream ID: {streamId}</p>
              </div>
              
              {/* This is the panel with approval buttons */}
              <RequestsPanel 
                liveId={streamId} 
                onApproved={handleCoHostApproval} 
                hasActiveCohost={cohosts.length > 0} 
              />
              
              {cohosts.length > 0 && (
                <HostCohostController 
                  cohosts={cohosts}
                  onRemove={removeCoHost}
                  onToggleMute={toggleCoHostMute}
                />
              )}
              
              {/* Debug panel for troubleshooting co-host issues */}
              <DebugPanel 
                isVisible={true} 
                cohosts={cohosts} 
                streamId={streamId}
              />
            </div>
          )}
        </div>
      )}

      {streamId && (
        <div className="mt-4 text-sm text-gray-600 font-mono bg-gray-100 px-3 py-1 rounded-md">Stream ID: {streamId}</div>
      )}
    </div>
  );
}
