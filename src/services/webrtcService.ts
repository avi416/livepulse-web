// src/services/webrtcService.ts
import { doc, getDoc, onSnapshot, collection, addDoc, setDoc } from 'firebase/firestore';
import { getFirestoreInstance } from './firebase';

function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ];

  // Optional TURN from Vite env
  const turnUrl = (import.meta as any).env?.VITE_TURN_URL as string | undefined;
  const turnUser = (import.meta as any).env?.VITE_TURN_USERNAME as string | undefined;
  const turnCred = (import.meta as any).env?.VITE_TURN_CREDENTIAL as string | undefined;
  if (turnUrl && turnUser && turnCred) {
    servers.push({ urls: turnUrl, username: turnUser, credential: turnCred });
  }
  return servers;
}

function getRtcConfig(role: 'broadcaster' | 'viewer'): RTCConfiguration {
  const env = (import.meta as any).env || {};
  const forceRelayViewer = (env.VITE_FORCE_RELAY_FOR_VIEWER || 'false') === 'true';
  const forceRelayBroadcaster = (env.VITE_FORCE_RELAY_FOR_BROADCASTER || 'false') === 'true';
  const config: RTCConfiguration = {
    iceServers: buildIceServers(),
    iceCandidatePoolSize: 2,
  };
  try {
    const hasTurn = (config.iceServers || []).some((s) => Array.isArray((s as any).urls) ? (s as any).urls.some((u: string) => u.startsWith('turn:') || u.startsWith('turns:')) : typeof (s as any).urls === 'string' && ((s as any).urls as string).startsWith('turn'));
    if (((role === 'viewer' && forceRelayViewer) || (role === 'broadcaster' && forceRelayBroadcaster))) {
      if (hasTurn) {
        (config as any).iceTransportPolicy = 'relay';
      } else {
        console.warn(`[RTC] ${role}: FORCE_RELAY requested but no TURN configured; falling back to default policy.`);
      }
    }
    console.log(`[RTC] ${role} config:`, { hasTurn, forceRelayViewer, forceRelayBroadcaster, policy: (config as any).iceTransportPolicy || 'all' });
  } catch {}
  return config;
}

function preferH264IfConfigured(transceiver: RTCRtpTransceiver) {
  try {
    const env = (import.meta as any).env || {};
    const prefer = (env.VITE_PREFER_H264 || 'false') === 'true';
    if (!prefer) return;
    const caps = (RTCRtpSender as any).getCapabilities?.(transceiver.sender.track?.kind || 'video');
    if (!caps || !caps.codecs) return;
    const codecs = caps.codecs.slice();
    const sorted = codecs.sort((a: any, b: any) => {
      const prio = (c: any) => (String(c.mimeType || '').toLowerCase().includes('h264') ? 0 : 1);
      return prio(a) - prio(b);
    });
    transceiver.setCodecPreferences?.(sorted);
    console.log('🎛️ Applied codec preference (H264 first)');
  } catch {}
}

/* ──────────────────────────────────────────────────────────────────────────
 * Broadcaster: יוצר PeerConnection ושולח אודיו/וידאו דרך Firestore signalling
 * מוסיף רק את ה־track הראשון מכל סוג (וידאו/אודיו) כדי להימנע מכפילויות
 * ────────────────────────────────────────────────────────────────────────── */
export async function createBroadcasterPC(
  stream: MediaStream,                // ❗ חייב להיות MediaStream תקף
  streamId: string,
  onRemoteTrack?: (s: MediaStream) => void
) {
  if (!stream || !(stream instanceof MediaStream)) {
    console.error('⚠️ createBroadcasterPC called without valid MediaStream!', stream);
    throw new Error('❌ Broadcaster must be started with a valid MediaStream');
  }

  console.log('🎥 Creating broadcaster PC for stream:', streamId);
  console.log(
    '📹 Local tracks:',
    stream.getTracks().map((t) => ({
      kind: t.kind,
      id: t.id,
      enabled: t.enabled,
      muted: (t as MediaStreamTrack).muted,
      readyState: (t as MediaStreamTrack).readyState,
    })),
  );

  const pc = new RTCPeerConnection(getRtcConfig('broadcaster'));

  // הוסף רק track אחד מכל סוג – זה יצמצם תקלות
  const videoTrack = stream.getVideoTracks()[0] || null;
  const audioTrack = stream.getAudioTracks()[0] || null;

  if (videoTrack) {
    console.log('➕ Adding VIDEO track:', videoTrack.id, {
      enabled: videoTrack.enabled,
      muted: videoTrack.muted,
      readyState: videoTrack.readyState,
    });
    const sender = pc.addTrack(videoTrack, stream);
    // try set H264 preference on sender transceiver if available
    try { preferH264IfConfigured((sender as any).transport?._transceiver || (pc.getTransceivers().find(t => t.sender === sender) as RTCRtpTransceiver)); } catch {}
  } else {
    console.warn('⚠️ No local VIDEO track found');
  }

  if (audioTrack) {
    console.log('➕ Adding AUDIO track:', audioTrack.id, {
      enabled: audioTrack.enabled,
      muted: audioTrack.muted,
      readyState: audioTrack.readyState,
    });
  pc.addTrack(audioTrack, stream);
  } else {
    console.warn('⚠️ No local AUDIO track found');
  }

  pc.ontrack = (event: RTCTrackEvent) => {
    console.log('📡 Broadcaster got remote track (loopback?):', event.track.kind, {
      readyState: event.track.readyState,
      muted: event.track.muted,
    });
    if (onRemoteTrack && event.streams && event.streams[0]) {
      onRemoteTrack(event.streams[0]);
    }
  };

  const db = getFirestoreInstance();
  const liveId = streamId;

  // שליחת ICE Candidates → candidates_broadcaster
  pc.onicecandidate = async (e) => {
    if (e.candidate) {
      try {
        console.log('🧊 Broadcaster ICE candidate:', e.candidate.candidate);
        await addDoc(
          collection(db, 'liveStreams', liveId, 'candidates_broadcaster'),
          e.candidate.toJSON(),
        );
      } catch (err) {
        console.error('❌ Failed to add broadcaster ICE candidate:', err);
      }
    }
  };

  // יצירת Offer ושמירה ב־Firestore
  console.log('📝 Creating broadcaster offer…');
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  try {
    await setDoc(doc(db, 'liveStreams', liveId, 'sdp', 'offer'), offer);
    console.log('✅ Broadcaster offer saved');
  } catch (err) {
    console.error('❌ Failed to save offer:', err);
    throw err;
  }

  // האזנה ל־Answer מהצופה
  const unsubAnswer = onSnapshot(
    doc(db, 'liveStreams', liveId, 'sdp', 'answer'),
    async (snap: any) => {
      if (!snap.exists()) return;
      const answer = snap.data();
      try {
        if (pc.signalingState !== 'stable') {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          console.log('✅ Remote description set from viewer answer');
        } else {
          console.log('ℹ️ Broadcaster signalingState is stable, skip setRemoteDescription');
        }
      } catch (err) {
        console.error('❌ Failed to set remote description:', err);
      }
    },
  );

  // האזנה ל־ICE מהצופה
  const unsubViewerICE = onSnapshot(
    collection(db, 'liveStreams', liveId, 'candidates_viewers'),
    (snap: any) => {
      snap.docChanges().forEach((change: any) => {
        if (change.type === 'added') {
          const c = change.doc.data();
          console.log('🧊 Adding viewer ICE candidate:', c.candidate);
          pc.addIceCandidate(new RTCIceCandidate(c)).catch((err) => {
            console.error('❌ Failed to add viewer ICE candidate:', err);
          });
        }
      });
    },
  );

  // לוגים למעקב
  pc.onconnectionstatechange = () => {
    console.log('🔗 Broadcaster connection state:', pc.connectionState);
  };
  pc.onnegotiationneeded = async () => {
    try {
      console.log('🧩 Broadcaster negotiationneeded: creating new offer');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await setDoc(doc(getFirestoreInstance(), 'liveStreams', liveId, 'sdp', 'offer'), offer);
    } catch (e) {
      console.error('❌ negotiationneeded failed:', e);
    }
  };
  let restarting = false;
  pc.oniceconnectionstatechange = async () => {
    console.log('🧊 Broadcaster ICE state:', pc.iceConnectionState);
    if ((pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') && !restarting) {
      console.warn('⚠️ Broadcaster ICE issue, attempting ICE restart…');
      try {
        restarting = true;
        const offer = await pc.createOffer({ iceRestart: true });
        await pc.setLocalDescription(offer);
        await setDoc(doc(getFirestoreInstance(), 'liveStreams', liveId, 'sdp', 'offer'), offer);
        console.log('🔁 Broadcaster ICE restart offer saved');
      } catch (err) {
        console.error('❌ ICE restart failed:', err);
      } finally {
        // allow future restarts if needed
        setTimeout(() => (restarting = false), 3000);
      }
    }
  };

  return { pc, unsubAnswer, unsubViewerICE };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Connect As Viewer: מאפשר למשתמש להתחבר כצופה בשידור חי
 * ────────────────────────────────────────────────────────────────────────── */
export async function connectAsViewer(liveId: string, videoEl: HTMLVideoElement) {
  console.log('👁️ Connecting as viewer to stream:', liveId);

  const db = getFirestoreInstance();

  // בדיקה אם השידור קיים ובלייב
  const liveRef = doc(db, 'liveStreams', liveId);
  const liveSnap = await getDoc(liveRef);
  if (!liveSnap.exists()) throw new Error('Live not found');
  const live = liveSnap.data() as any;
  if (live.status !== 'live') throw new Error('Live has ended');

  // קריאת Offer
  const offerRef = doc(db, 'liveStreams', liveId, 'sdp', 'offer');
  let offerSnap = await getDoc(offerRef);
  if (!offerSnap.exists()) {
    console.warn('ℹ️ Offer not found yet, waiting 500ms…');
    await new Promise((r) => setTimeout(r, 500));
    offerSnap = await getDoc(offerRef);
  }
  if (!offerSnap.exists()) throw new Error('Offer not found');
  const offer = offerSnap.data();

  const pc = new RTCPeerConnection(getRtcConfig('viewer'));

  // Ensure we will receive media even before first packets arrive
  try { const t = pc.addTransceiver('video', { direction: 'recvonly' }); preferH264IfConfigured(t); } catch {}
  try { pc.addTransceiver('audio', { direction: 'recvonly' }); } catch {}

  // פונקציה שמנסה לנגן וידאו (מטפלת ב-autoplay block)
  function tryPlay(video: HTMLVideoElement) {
    video
      .play()
      .then(() => {
        console.log('▶️ Video started automatically');
      })
      .catch((err) => {
        console.warn('⚠️ Autoplay blocked, waiting for user gesture:', err);
        const resume = () => {
          video.play().catch((e) => console.warn('❌ Still failed to play:', e));
          window.removeEventListener('click', resume);
          window.removeEventListener('touchstart', resume);
          window.removeEventListener('keydown', resume);
        };
        window.addEventListener('click', resume, { once: true });
        window.addEventListener('touchstart', resume, { once: true });
        window.addEventListener('keydown', resume, { once: true });
      });
  }

  // קבלת Tracks מהשדר
  pc.ontrack = (e) => {
    console.log('📡 Viewer received track:', e.track.kind, {
      muted: e.track.muted,
      readyState: e.track.readyState,
    });

  // נשתמש ב־stream שה-RTC מוסיף (e.streams[0]) או ניצור אחד מה-track
  const incoming = (e.streams && e.streams[0]) || new MediaStream([e.track]);
    if (incoming) {
      if (videoEl.srcObject !== incoming) {
        console.log('🎥 Using e.streams[0]');
        videoEl.srcObject = incoming;
      }

      // הגדרות מומלצות לצפייה
      videoEl.autoplay = true;
      videoEl.playsInline = true;
      videoEl.controls = true;
      videoEl.muted = true; // תחילה על mute כדי לאפשר autoplay; המשתמש יוכל להפעיל קול ידנית
      try {
        const onMeta = () => console.log('🎥 viewer loadedmetadata', { w: videoEl.videoWidth, h: videoEl.videoHeight, duration: videoEl.duration });
        const onCanPlay = () => console.log('🎥 viewer canplay');
        const onPlay = () => console.log('🎥 viewer playing');
        const onError = (ev: any) => console.error('🎥 viewer video error', ev?.message || ev);
        videoEl.addEventListener('loadedmetadata', onMeta, { once: true });
        videoEl.addEventListener('canplay', onCanPlay, { once: true });
        videoEl.addEventListener('play', onPlay, { once: true });
        videoEl.addEventListener('error', onError);
      } catch {}
      tryPlay(videoEl);
    }
  };

  // שליחת ICE Candidates → candidates_viewers
  pc.onicecandidate = async (e) => {
    if (e.candidate) {
      try {
        await addDoc(collection(db, 'liveStreams', liveId, 'candidates_viewers'), e.candidate.toJSON());
        console.log('🧊 Viewer ICE candidate sent');
      } catch (err) {
        console.error('❌ Failed to add viewer ICE candidate:', err);
      }
    }
  };

  // Offer → RemoteDescription
  await pc.setRemoteDescription(new RTCSessionDescription(offer));

  // Answer → Firestore
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  try {
    await setDoc(doc(db, 'liveStreams', liveId, 'sdp', 'answer'), answer);
    console.log('✅ Viewer answer saved');
  } catch (err) {
    console.error('❌ Failed to save answer:', err);
    throw err;
  }

  // Listen for updated offers (ICE restarts, renegotiation)
  const unsubOffer = onSnapshot(doc(db, 'liveStreams', liveId, 'sdp', 'offer'), async (snap: any) => {
    if (!snap.exists()) return;
    const latestOffer = snap.data();
    try {
      if (pc.signalingState !== 'stable' && pc.remoteDescription?.type === 'offer') {
        // already handling
        return;
      }
      await pc.setRemoteDescription(new RTCSessionDescription(latestOffer));
      const newAnswer = await pc.createAnswer();
      await pc.setLocalDescription(newAnswer);
      await setDoc(doc(db, 'liveStreams', liveId, 'sdp', 'answer'), newAnswer);
      console.log('🔁 Viewer updated answer after new offer');
    } catch (err) {
      console.error('❌ Failed to handle updated offer:', err);
    }
  });

  // ICE Candidates ← Broadcaster
  const unsubBroadcasterICE = onSnapshot(
    collection(db, 'liveStreams', liveId, 'candidates_broadcaster'),
    (snap: any) => {
      snap.docChanges().forEach((change: any) => {
        if (change.type === 'added') {
          const c = change.doc.data();
          console.log('🧊 Adding broadcaster ICE candidate:', c.candidate);
          pc.addIceCandidate(new RTCIceCandidate(c)).catch((err) => {
            console.error('❌ Failed to add broadcaster ICE candidate:', err);
          });
        }
      });
    },
  );

  // לוגים
  pc.onconnectionstatechange = () => {
    console.log('🔗 Viewer connection state:', pc.connectionState);
  };
  pc.oniceconnectionstatechange = () => {
    console.log('🧊 Viewer ICE state:', pc.iceConnectionState);
  };
  pc.onicecandidateerror = (e: any) => {
    console.error('🧊 Viewer ICE candidate error', e?.errorText || e);
  };

  // Periodic stats logging to diagnose black screen
  const statsTimer = setInterval(async () => {
    try {
      const stats = await pc.getStats();
      let bytes = 0;
      let frames = 0;
      let width = 0;
      let height = 0;
      let selected: any = null;
      stats.forEach((r: any) => {
        if (r.type === 'inbound-rtp' && r.kind === 'video') {
          bytes = r.bytesReceived || bytes;
          frames = r.framesDecoded || frames;
        }
        if (r.type === 'track' && r.kind === 'video') {
          width = r.frameWidth || width;
          height = r.frameHeight || height;
        }
        if (r.type === 'transport' && r.selectedCandidatePairId && typeof stats.get === 'function') {
          selected = stats.get(r.selectedCandidatePairId);
        }
      });
      if (selected) {
        const local = stats.get(selected.localCandidateId);
        const remote = stats.get(selected.remoteCandidateId);
        console.log('📈 viewer stats', {
          bytesReceived: bytes,
          framesDecoded: frames,
          frameSize: `${width}x${height}`,
          candidatePair: {
            state: selected.state,
            local: local ? { type: local.candidateType, ip: local.ip, protocol: local.protocol } : null,
            remote: remote ? { type: remote.candidateType, ip: remote.ip, protocol: remote.protocol } : null,
          },
        });
      }
    } catch {}
  }, 3000);

  const cleanup = () => {
    try {
      unsubBroadcasterICE();
    } catch {}
    try { unsubOffer(); } catch {}
    try { clearInterval(statsTimer); } catch {}
    try {
      pc.close();
    } catch {}
  };

  return { pc, cleanup };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Host Accept Co-Host: מאפשר לחבר מארח לקבל מארח-משנה לשידור
 * ────────────────────────────────────────────────────────────────────────── */
export async function hostAcceptCoHost(
  streamId: string,
  localStream: MediaStream,
  remoteVideoEl: HTMLVideoElement,
  coHostId: string
) {
  console.log('🤝 Host accepting co-host:', coHostId, 'for stream:', streamId);
  
  if (!localStream || !(localStream instanceof MediaStream)) {
    console.error('⚠️ hostAcceptCoHost called without valid MediaStream!', localStream);
    throw new Error('❌ Host must have a valid local MediaStream');
  }

  const db = getFirestoreInstance();
  const pc = new RTCPeerConnection(getRtcConfig('broadcaster'));
  
  // Add local tracks to send to co-host
  localStream.getTracks().forEach(track => {
    console.log('➕ Host adding track to co-host connection:', track.kind);
    pc.addTrack(track, localStream);
  });
  
  // Set up remote video display
  pc.ontrack = (event) => {
    console.log('📡 Host received track from co-host:', event.track.kind);
    if (event.streams && event.streams[0]) {
      if (remoteVideoEl.srcObject !== event.streams[0]) {
        console.log('🎥 Setting co-host video');
        remoteVideoEl.srcObject = event.streams[0];
        remoteVideoEl.autoplay = true;
        remoteVideoEl.playsInline = true;
      }
    }
  };
  
  // ICE handling
  pc.onicecandidate = async (event) => {
    if (event.candidate) {
      try {
        console.log('🧊 Host sending ICE candidate to co-host');
        
        // Validate all parameters first
        if (!streamId || !coHostId || !db) {
          console.error('⚠️ Missing required parameters for ICE candidate:', { streamId, coHostId });
          return;
        }
        
        // Create path using proper collection/document pattern
        const liveStreamDoc = doc(db, 'liveStreams', streamId);
        const cohostDoc = doc(collection(liveStreamDoc, 'cohost'), coHostId);
        const candidatesCollection = collection(cohostDoc, 'hostCandidates');
        
        await addDoc(candidatesCollection, event.candidate.toJSON());
      } catch (err) {
        console.error('❌ Failed to send host ICE candidate:', err);
      }
    }
  };

  // Wait for co-host offer
  const offerDoc = doc(db, 'liveStreams', streamId, 'cohost', coHostId, 'offer');
  let offerData;
  
  // Check if offer already exists or wait for it
  const offerSnap = await getDoc(offerDoc);
  if (offerSnap.exists()) {
    offerData = offerSnap.data();
  } else {
    console.log('⏳ Waiting for co-host offer...');
    // Wait for offer with a timeout
    offerData = await new Promise((resolve, reject) => {
      const unsubscribe = onSnapshot(offerDoc, (snap: any) => {
        if (snap.exists()) {
          const data = snap.data();
          unsubscribe();
          resolve(data);
        }
      });
      
      // Set timeout to prevent waiting forever
      setTimeout(() => {
        unsubscribe();
        reject(new Error('Timeout waiting for co-host offer'));
      }, 15000);
    }).catch(err => {
      console.error('❌ Error waiting for co-host offer:', err);
      throw err;
    });
  }
  
  // Set remote description from offer
  try {
    console.log('📝 Setting remote description from co-host offer');
    await pc.setRemoteDescription(new RTCSessionDescription(offerData as RTCSessionDescriptionInit));
  } catch (err) {
    console.error('❌ Failed to set remote description:', err);
    throw err;
  }
  
  // Create and set answer
  try {
    console.log('📝 Creating answer for co-host');
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    // Send answer to co-host
    console.log('📤 Sending answer to co-host');
    
    // Validate path parameters
    if (!streamId || !coHostId) {
      console.error('⚠️ Missing required parameters for sending answer:', { streamId, coHostId });
      throw new Error('Missing stream ID or co-host ID for sending answer');
    }
    
    // שמירת התשובה במסמך של המארח-משנה
    const liveStreamDoc = doc(db, 'liveStreams', streamId);
    const cohostDoc = doc(collection(liveStreamDoc, 'cohost'), coHostId);
    await setDoc(cohostDoc, { answer }, { merge: true });
  } catch (err) {
    console.error('❌ Failed to create or send answer:', err);
    throw err;
  }
  
  // Listen for ICE candidates from co-host
  let unsubCoHostCandidates = () => {};
  
  try {
    // Validate path parameters
    if (!streamId || !coHostId) {
      console.error('⚠️ Missing required parameters for ICE candidates:', { streamId, coHostId });
      throw new Error('Missing stream ID or co-host ID for ICE candidates');
    }
    
    // Create path using proper collection/document pattern
    const liveStreamDoc = doc(db, 'liveStreams', streamId);
    const cohostDoc = doc(collection(liveStreamDoc, 'cohost'), coHostId);
    const candidatesCollection = collection(cohostDoc, 'coHostCandidates');
    
    unsubCoHostCandidates = onSnapshot(
      candidatesCollection,
      (snapshot: any) => {
        snapshot.docChanges().forEach((change: any) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            console.log('🧊 Adding ICE candidate from co-host');
            pc.addIceCandidate(new RTCIceCandidate(data))
              .catch(err => console.error('❌ Failed to add co-host ICE candidate:', err));
          }
        });
      },
      (error: any) => {
        console.error('❌ Error listening for co-host ICE candidates:', error);
      }
    );
  } catch (error) {
    console.error('❌ Failed to set up co-host ICE candidates listener:', error);
  }
  
  // Connection state monitoring
  pc.onconnectionstatechange = () => {
    console.log('🔗 Host-CoHost connection state:', pc.connectionState);
    if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
      console.log('⚠️ Co-host connection ended or failed');
      // Could implement cleanup or reconnection logic here
    }
  };
  
  // ICE connection state monitoring
  pc.oniceconnectionstatechange = () => {
    console.log('🧊 Host-CoHost ICE state:', pc.iceConnectionState);
    if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
      console.warn('⚠️ Co-host ICE connection issue');
    }
  };
  
  return {
    pc,
    cleanup: () => {
      try {
        unsubCoHostCandidates();
        pc.close();
      } catch (err) {
        console.error('❌ Error during cleanup:', err);
      }
    }
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Connect As Co-Host: מאפשר למשתמש להתחבר כמארח-משנה לשידור קיים
 * ────────────────────────────────────────────────────────────────────────── */
export async function connectAsCoHost(
  streamId: string,
  localStream: MediaStream,
  hostVideoEl?: HTMLVideoElement,
  userId?: string
) {
  console.log('👥 Connecting as co-host to stream:', streamId);
  
  // Import getAuth from firebase/auth
  const { getAuth } = await import('firebase/auth');
  
  // Create video element if not provided
  const videoEl = hostVideoEl || document.createElement('video');
  videoEl.autoplay = true;
  videoEl.playsInline = true;
  
  // Get user ID if not provided
  const auth = getAuth();
  const uid = userId || auth.currentUser?.uid;
  
  if (!uid) {
    throw new Error('User must be logged in to join as co-host');
  }
  
  // Use the existing coHostJoinStream function for implementation
  const connection = await coHostJoinStream(streamId, localStream, videoEl, uid);
  
  return {
    pc: connection.pc,
    unsubAnswer: () => {}, // This will be set by coHostJoinStream
    unsubHostICE: connection.cleanup,
    cleanup: connection.cleanup
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Co-Host Join Stream: מאפשר למשתמש להצטרף כמארח-משנה לשידור קיים
 * ────────────────────────────────────────────────────────────────────────── */
export async function coHostJoinStream(
  streamId: string,
  localStream: MediaStream,
  hostVideoEl: HTMLVideoElement,
  coHostId: string
) {
  console.log('👥 Co-Host joining stream:', streamId, 'as co-host ID:', coHostId);
  
  if (!localStream || !(localStream instanceof MediaStream)) {
    console.error('⚠️ coHostJoinStream called without valid MediaStream!', localStream);
    throw new Error('❌ Co-Host must have a valid local MediaStream');
  }

  if (!streamId || typeof streamId !== 'string') {
    console.error('⚠️ coHostJoinStream called without valid streamId!', streamId);
    throw new Error('❌ Co-Host must have a valid streamId');
  }

  if (!coHostId || typeof coHostId !== 'string') {
    console.error('⚠️ coHostJoinStream called without valid coHostId!', coHostId);
    throw new Error('❌ Co-Host must have a valid coHostId');
  }

  const db = getFirestoreInstance();
  const pc = new RTCPeerConnection(getRtcConfig('broadcaster'));
  
  // Add local tracks to send to host
  localStream.getTracks().forEach(track => {
    console.log('➕ Co-Host adding track to host connection:', track.kind);
    pc.addTrack(track, localStream);
  });
  
  // Set up remote video display for viewing the host's stream
  pc.ontrack = (event) => {
    console.log('📡 Co-Host received track from host:', event.track.kind);
    if (event.streams && event.streams[0]) {
      if (hostVideoEl.srcObject !== event.streams[0]) {
        console.log('🎥 Setting host video for co-host');
        hostVideoEl.srcObject = event.streams[0];
        hostVideoEl.autoplay = true;
        hostVideoEl.playsInline = true;
      }
    }
  };
  
  // ICE handling
  pc.onicecandidate = async (event) => {
    if (event.candidate) {
      try {
        console.log('🧊 Co-Host sending ICE candidate to host');
        
        // Validate all parameters first
        if (!streamId || !coHostId || !db) {
          console.error('⚠️ Missing required parameters for ICE candidate:', { streamId, coHostId });
          return;
        }
        
        // Create path using proper collection/document pattern
        const liveStreamDoc = doc(db, 'liveStreams', streamId);
        const cohostDoc = doc(collection(liveStreamDoc, 'cohost'), coHostId);
        const candidatesCollection = collection(cohostDoc, 'coHostCandidates');
        
        await addDoc(candidatesCollection, event.candidate.toJSON());
      } catch (err) {
        console.error('❌ Failed to send co-host ICE candidate:', err);
      }
    }
  };

  // Create and send offer to host
  try {
    console.log('📝 Creating offer for host');
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    // Send offer to host
    console.log('📤 Sending offer to host');
    
    // Validate path parameters
    if (!streamId || !coHostId) {
      console.error('⚠️ Missing required parameters for sending offer:', { streamId, coHostId });
      throw new Error('Missing stream ID or co-host ID for sending offer');
    }
    
    // בניית המסמך של ה-offer לפי המבנה הנכון
    // במבנה של Firestore צריך להיות מספר זוגי של מקטעים: אוסף/מסמך/אוסף/מסמך
    // מכיוון ש-'offer' הוא מסמך, אנחנו צריכים לבנות את הנתיב אחרת
    
    // יצירת המסמך עצמו
    const liveStreamDoc = doc(db, 'liveStreams', streamId);
    // יצירת תת-אוסף 'cohost'
    const cohostCollection = collection(liveStreamDoc, 'cohost');
    // יצירת המסמך הספציפי של המארח-המשנה
    const cohostDoc = doc(cohostCollection, coHostId);
    // שמירת ה-offer כשדה בתוך המסמך, במקום כמסמך נפרד
    await setDoc(cohostDoc, { offer }, { merge: true });
  } catch (err) {
    console.error('❌ Failed to create or send offer:', err);
    throw err;
  }
  
  // Wait for host's answer
  console.log('⏳ Waiting for host answer...');
  
  // Validate path parameters
  if (!streamId || !coHostId) {
    console.error('⚠️ Missing required parameters for receiving answer:', { streamId, coHostId });
    throw new Error('Missing stream ID or co-host ID for receiving answer');
  }
  
  // שימוש באותה שיטה עבור האזנה לתשובה
  const liveStreamDoc = doc(db, 'liveStreams', streamId);
  const cohostCollection = collection(liveStreamDoc, 'cohost');
  const cohostDoc = doc(cohostCollection, coHostId);
  
  const answerData = await new Promise((resolve, reject) => {
    const unsubscribe = onSnapshot(cohostDoc, (snap: any) => {
      if (snap.exists() && snap.data().answer) {
        const data = snap.data().answer;
        unsubscribe();
        resolve(data);
      }
    });
    
    // Set timeout to prevent waiting forever
    setTimeout(() => {
      unsubscribe();
      reject(new Error('Timeout waiting for host answer'));
    }, 20000);
  }).catch(err => {
    console.error('❌ Error waiting for host answer:', err);
    throw err;
  });
  
  // Set remote description from answer
  try {
    console.log('📝 Setting remote description from host answer');
    await pc.setRemoteDescription(new RTCSessionDescription(answerData as RTCSessionDescriptionInit));
  } catch (err) {
    console.error('❌ Failed to set remote description:', err);
    throw err;
  }
  
  // Listen for ICE candidates from host
  let unsubHostCandidates = () => {};
  
  try {
    // Validate path parameters
    if (!streamId || !coHostId) {
      console.error('⚠️ Missing required parameters for ICE candidates:', { streamId, coHostId });
      throw new Error('Missing stream ID or co-host ID for ICE candidates');
    }
    
    // Use subcollection for ice candidates
    const liveStreamDoc = doc(db, 'liveStreams', streamId);
    const cohostDoc = doc(collection(liveStreamDoc, 'cohost'), coHostId);
    
    // Create a subcollection for host ICE candidates
    const candidatesCollection = collection(cohostDoc, 'hostCandidates');
    
    unsubHostCandidates = onSnapshot(
      candidatesCollection,
      (snapshot: any) => {
        snapshot.docChanges().forEach((change: any) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            console.log('🧊 Adding ICE candidate from host');
            pc.addIceCandidate(new RTCIceCandidate(data))
              .catch(err => console.error('❌ Failed to add host ICE candidate:', err));
          }
        });
      },
      (error: any) => {
        console.error('❌ Error listening for host ICE candidates:', error);
      }
    );
  } catch (error) {
    console.error('❌ Failed to set up host ICE candidates listener:', error);
  }
  
  // Connection state monitoring
  pc.onconnectionstatechange = () => {
    console.log('🔗 CoHost-Host connection state:', pc.connectionState);
    if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
      console.log('⚠️ Host connection ended or failed');
    }
  };
  
  // ICE connection state monitoring
  pc.oniceconnectionstatechange = () => {
    console.log('🧊 CoHost-Host ICE state:', pc.iceConnectionState);
    if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
      console.warn('⚠️ Host ICE connection issue');
    }
  };
  
  return {
    pc,
    cleanup: () => {
      try {
        unsubHostCandidates();
        pc.close();
      } catch (err) {
        console.error('❌ Error during cleanup:', err);
      }
    }
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * תאימות לאחור
 * ────────────────────────────────────────────────────────────────────────── */
export async function broadcasterCreateOffer(broadcaster: ReturnType<typeof createBroadcasterPC>) {
  return broadcaster;
}
export async function watcherJoin(streamId: string, videoEl: HTMLVideoElement) {
  return await connectAsViewer(streamId, videoEl);
}