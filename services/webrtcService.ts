import { doc, getDoc, onSnapshot, collection, addDoc, setDoc } from 'firebase/firestore';
import { getAuthInstance, getFirestoreInstance } from './firebase';
// nuclearFix helpers are no longer needed after simplifying the viewer attach path

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
  if (!videoTrack && !audioTrack) console.warn('⚠️ No local tracks found on stream');

  if (videoTrack) {
    try { videoTrack.enabled = true; } catch {}
    console.log('➕ Adding VIDEO track:', videoTrack.id, {
      enabled: videoTrack.enabled,
      muted: videoTrack.muted,
      readyState: videoTrack.readyState,
    });
    const sender = pc.addTrack(videoTrack, stream);
    // try set H264 preference on sender transceiver if available
    try { 
      const videoTx = pc.getTransceivers?.()?.find(t => t.sender === sender);
      if (videoTx) preferH264IfConfigured(videoTx);
    } catch {}
  } else {
    console.warn('⚠️ No local VIDEO track found');
  }

  if (audioTrack) {
    try { audioTrack.enabled = true; } catch {}
    console.log('➕ Adding AUDIO track:', audioTrack.id, {
      enabled: audioTrack.enabled,
      muted: audioTrack.muted,
      readyState: audioTrack.readyState,
    });
    pc.addTrack(audioTrack, stream);
  } else {
    console.warn('⚠️ No local AUDIO track found');
  }

  // Diagnostics: list senders/transceivers
  try {
    const senders = pc.getSenders();
    console.log('📤 Broadcaster senders:', senders.map((s) => ({ kind: s.track?.kind, state: s.track?.readyState, enabled: s.track?.enabled })));
  } catch {}
  try {
    const txs = pc.getTransceivers?.() || [];
    console.log('📡 Broadcaster transceivers:', txs.map((t: any) => ({ dir: t.direction, current: t.currentDirection, kind: t.sender?.track?.kind, enabled: t.sender?.track?.enabled })));
  } catch {}

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

  // יצירת Offer ושמירה ב־Firestore (save full object for compatibility)
  console.log('📝 Creating broadcaster offer…');
  // (We already bound a single transceiver per kind above.)
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  try {
    const sdpStr = offer?.sdp || '';
    if (!/\nm=video /.test(sdpStr)) {
      console.warn('⚠️ Offer SDP has no m=video line; viewer may get audio-only');
    }
  } catch {}

  try {
    await setDoc(doc(db, 'liveStreams', liveId, 'sdp', 'offer'), offer as any);
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
        const current = pc.remoteDescription?.sdp || '';
        const next = answer?.sdp || '';
        if (!current || current !== next) {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          console.log('✅ Remote description set from viewer answer');
        } else {
          console.log('ℹ️ Answer SDP unchanged — skipping reapply');
        }
      } catch (err) {
        console.error('❌ Failed to set remote description:', err);
      }
    },
  );

  // האזנה ל־ICE מהצופה
  // Viewer ICE (plural) — keep a single path for write/read symmetry
  const unsubViewerICEPlural = onSnapshot(
    collection(db, 'liveStreams', liveId, 'candidates_viewers'),
    (snap: any) => {
      snap.docChanges().forEach((change: any) => {
        if (change.type === 'added') {
          const c = change.doc.data();
          console.log('🧊 Adding viewer ICE candidate (plural):', c.candidate);
          pc.addIceCandidate(new RTCIceCandidate(c)).catch((err) => {
            console.error('❌ Failed to add viewer ICE candidate:', err);
          });
        }
      });
    },
  );

  // לוגים למעקב
  pc.onconnectionstatechange = () => {
    console.log('host pc:', pc.connectionState);
  };
  pc.oniceconnectionstatechange = () => {
    console.log('host ice:', pc.iceConnectionState);
  };
  pc.onnegotiationneeded = async () => {
    try {
      console.log('🧩 Broadcaster negotiationneeded: creating new offer');
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await setDoc(doc(getFirestoreInstance(), 'liveStreams', liveId, 'sdp', 'offer'), offer as any);
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
  await setDoc(doc(getFirestoreInstance(), 'liveStreams', liveId, 'sdp', 'offer'), offer as any);
        console.log('🔁 Broadcaster ICE restart offer saved');
      } catch (err) {
        console.error('❌ ICE restart failed:', err);
      } finally {
        // allow future restarts if needed
        setTimeout(() => (restarting = false), 3000);
      }
    }
  };

  // Broadcaster stats log to ensure frames are actually encoded
  try {
    let zeroTicks = 0;
    let lastByteCount = 0;
    let isEncodingDetected = false;
    
    const statsTimer = setInterval(async () => {
      try {
        // Prefer querying the specific video sender for accurate outbound stats
        const videoSender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
        let bytes = 0, frames = 0, width = 0, height = 0;
        let bytesIncreasing = false;
        
        if (videoSender && typeof (videoSender as any).getStats === 'function') {
          const s = await (videoSender as any).getStats();
          s.forEach((r: any) => {
            if (r.type === 'outbound-rtp') {
              bytes = r.bytesSent || bytes;
              frames = r.framesEncoded || frames;
            }
            if (r.type === 'track') {
              width = r.frameWidth || width;
              height = r.frameHeight || height;
            }
          });
        } else {
          const stats = await pc.getStats();
          stats.forEach((r: any) => {
            if (r.type === 'outbound-rtp' && (r.kind === 'video' || r.mediaType === 'video')) {
              bytes = r.bytesSent || bytes;
              frames = r.framesEncoded || frames;
            }
            if (r.type === 'track' && (r.kind === 'video' || r.mediaType === 'video')) {
              width = r.frameWidth || width;
              height = r.frameHeight || height;
            }
          });
        }
        
        // Check if bytes are increasing, which indicates data is being sent
        bytesIncreasing = bytes > lastByteCount;
        lastByteCount = bytes;
        
        // If the RVFC is showing frames but stats aren't, we're still encoding
        if (bytesIncreasing) {
          isEncodingDetected = true;
        }
        
        // If we're connected to a viewer, we're likely encoding successfully
        if (pc.iceConnectionState === 'connected' || pc.connectionState === 'connected') {
          // Mark as encoding detected if we've been connected for at least a few seconds
          if (!isEncodingDetected) {
            setTimeout(() => {
              isEncodingDetected = true;
            }, 3000);
          }
        }
        
        console.log('📈 host stats', { 
          bytesSent: bytes, 
          framesEncoded: frames, 
          frameSize: `${width}x${height}`,
          bytesIncreasing,
          isEncodingDetected,
          connectionState: pc.connectionState,
          iceState: pc.iceConnectionState
        });
        
        if (frames === 0 && bytes === 0 && !isEncodingDetected) {
          zeroTicks += 1;
          if (zeroTicks >= 4) {
            // Only warn if we're not connected to a viewer yet
            if (pc.iceConnectionState !== 'connected' && pc.connectionState !== 'connected') {
              console.warn('⚠️ Host not encoding yet (framesEncoded=0). Check camera/SDP m=video and sender binding.');
            }
            zeroTicks = 0; // rate-limit warnings
          }
        } else {
          zeroTicks = 0;
        }
      } catch {}
    }, 3000);
    (pc as any)._statsTimer = statsTimer;
  } catch {}

  const unsubViewerICE = () => { try { unsubViewerICEPlural(); } catch {} };
  return { pc, unsubAnswer, unsubViewerICE };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Viewer: קורא Offer, מחזיר Answer ומתחבר לשידור
 * מטפל ב-autoplay (הוספת מאזיני click/touch/keydown במקרה של חסימה)
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

  // קבלת Tracks מהשדר – וידאו מוזן ל-<video> בלבד; אודיו מושמע דרך <audio> נסתר
  pc.ontrack = (e) => {
    console.log('📡 Viewer received track:', e.track.kind, {
      muted: e.track.muted,
      readyState: e.track.readyState,
    });

    if (!e.streams || !e.streams[0]) {
      console.error('❌ No streams in track event!');
      return;
    }

    if (e.track.kind === 'video') {
      try {
        // Feed a stream that contains only the video track to avoid edge cases
        const ms = new MediaStream([e.track]);
        videoEl.srcObject = ms;
        videoEl.playsInline = true;
        videoEl.play().catch(() => {
          const resume = () => videoEl.play().catch(() => {});
          const once = { once: true } as AddEventListenerOptions;
          document.addEventListener('click', resume, once);
          document.addEventListener('touchstart', resume, once);
          document.addEventListener('keydown', resume, once);
        });
      } catch (err) {
        console.error('Failed to attach video track to element', err);
      }
    } else if (e.track.kind === 'audio') {
      try {
        const audioId = `viewer-audio-${liveId}`;
        let au = document.getElementById(audioId) as HTMLAudioElement | null;
        if (!au) {
          au = document.createElement('audio');
          au.id = audioId;
          au.style.cssText = 'position:fixed; left:-99999px; top:-99999px; width:1px; height:1px; opacity:0; pointer-events:none;';
          (au as any).playsInline = true;
          document.body.appendChild(au);
        }
        au.srcObject = new MediaStream([e.track]);
        // Try to sync mute state to the video element
        try { (au as any).muted = (videoEl as any).muted ?? false; } catch {}
        au.play().catch(() => {});
      } catch (err) {
        console.error('Failed to attach audio track', err);
      }
    }
  };

  // שליחת ICE Candidates → candidates_viewers (plural)
  pc.onicecandidate = async (e) => {
    if (e.candidate) {
      try {
        const json = e.candidate.toJSON();
        await addDoc(collection(db, 'liveStreams', liveId, 'candidates_viewers'), json);
        console.log('🧊 Viewer ICE candidate sent (plural)');
      } catch (err) {
        console.error('❌ Failed to add viewer ICE candidate:', err);
      }
    }
  };

  // Offer → RemoteDescription
  const offerDesc = (offer && offer.type && offer.sdp)
    ? offer
    : { type: 'offer', sdp: offer?.sdp };
  await pc.setRemoteDescription(new RTCSessionDescription(offerDesc as any));

  // Answer → Firestore (type:"answer")
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  try {
    // Always save the answer as {type, sdp} for compatibility
    await setDoc(doc(db, 'liveStreams', liveId, 'sdp', 'answer'), { type: 'answer', sdp: answer.sdp });
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
      // Only apply if in stable state to avoid collisions
      if (pc.signalingState !== 'stable') {
        console.log('Skipping offer update - not in stable state:', pc.signalingState);
        return;
      }
      
      const normalized = (latestOffer && latestOffer.type && latestOffer.sdp)
        ? latestOffer
        : { type: 'offer', sdp: latestOffer?.sdp };
      
      await pc.setRemoteDescription(new RTCSessionDescription(normalized as any));
      const newAnswer = await pc.createAnswer();
      await pc.setLocalDescription(newAnswer);
      await setDoc(doc(db, 'liveStreams', liveId, 'sdp', 'answer'), { type: 'answer', sdp: newAnswer.sdp });
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
    console.log('viewer ice:', pc.iceConnectionState);
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
      stats.forEach((r: any) => {
        // Chromium uses kind, FF uses mediaType sometimes
        const isVideo = r.kind === 'video' || r.mediaType === 'video';
        if (r.type === 'inbound-rtp' && isVideo) {
          bytes = r.bytesReceived || bytes;
          frames = r.framesDecoded || frames;
        }
        if (r.type === 'track' && isVideo) {
          width = r.frameWidth || width;
          height = r.frameHeight || height;
        }
      });
      
      console.log('📈 viewer stats', {
        bytesReceived: bytes,
        framesDecoded: frames,
        frameSize: `${width}x${height}`,
        videoElSize: `${videoEl.videoWidth}x${videoEl.videoHeight}`,
        connectionState: pc.connectionState,
        iceState: pc.iceConnectionState
      });
      
      // If frames are being decoded but element reports 0x0, just log once; avoid resets that interrupt play
      if (frames > 0 && (videoEl.videoWidth === 0 || videoEl.videoHeight === 0)) {
        console.log('ℹ️ Frames decoded but video element size is 0x0 – waiting for metadata (no forced reload)');
        // As a harmless hint for CSS object-fit, set data-source to landscape until metadata arrives
        try { videoEl.setAttribute('data-source', 'landscape'); } catch {}
      }
    } catch (e) {
      console.error("Stats error:", e);
    }
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
    try {
      const audioId = `viewer-audio-${liveId}`;
      const au = document.getElementById(audioId);
      au?.parentElement?.removeChild(au);
    } catch {}
  };

  return { pc, cleanup };
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

/* ──────────────────────────────────────────────────────────────────────────
 * Co-host support: connect viewer as sender to host
 * Signaling structure mirrors broadcaster/viewer but targets host endpoint
 * Firestore paths:
 *   liveStreams/{id}/cohost_sdp/{offer|answer}
 *   liveStreams/{id}/candidates_cohost_inbound  (from cohost → host)
 *   liveStreams/{id}/candidates_cohost_outbound (from host → cohost)
 * The host side should listen and consume tracks.
 * ────────────────────────────────────────────────────────────────────────── */
export async function connectAsCoHost(liveId: string, localVideoEl: HTMLVideoElement) {
  const db = getFirestoreInstance();
  const auth = getAuthInstance();
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  const uid = user.uid;
  // Get local media
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  if (localVideoEl) { localVideoEl.srcObject = stream; localVideoEl.muted = true; localVideoEl.playsInline = true; }

  const pc = new RTCPeerConnection(getRtcConfig('viewer'));
  for (const t of stream.getTracks()) pc.addTrack(t, stream);

  // Publish ICE
  pc.onicecandidate = async (e) => {
    if (!e.candidate) return;
    await addDoc(collection(db, 'liveStreams', liveId, 'cohosts', uid, 'candidates_in'), e.candidate.toJSON());
  };

  // Create offer → cohost_sdp/offer
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await setDoc(doc(db, 'liveStreams', liveId, 'cohosts', uid, 'sdp', 'offer'), offer);
  
  // Wait for host answer → cohost_sdp/answer (subscribe to avoid races)
  const answerRef = doc(db, 'liveStreams', liveId, 'cohosts', uid, 'sdp', 'answer');
  await new Promise<void>((resolve, reject) => {
    const unsub = onSnapshot(answerRef as any, (snap: any) => {
      try {
        if (!snap.exists()) return;
        const data = snap.data();
        if (!data?.type || data.type !== 'answer') return;
        pc.setRemoteDescription(new RTCSessionDescription(data as any))
          .then(() => { try { unsub(); } catch {}; resolve(); })
          .catch((e) => { try { unsub(); } catch {}; reject(e); });
      } catch (e) { try { unsub(); } catch {}; reject(e as any); }
    });
  });

  // Consume ICE from host → candidates_cohost_outbound
  const unsubICE = onSnapshot(collection(db, 'liveStreams', liveId, 'cohosts', uid, 'candidates_out'), (snap: any) => {
    snap.docChanges().forEach((ch: any) => {
      if (ch.type !== 'added') return;
      const c = ch.doc.data();
      pc.addIceCandidate(new RTCIceCandidate(c)).catch((err) => console.error('cohost addIceCandidate failed', err));
    });
  });

  return { pc, stream, cleanup: () => { try { unsubICE(); } catch {}; try { pc.close(); } catch {}; stream.getTracks().forEach(t => { try { t.stop(); } catch {} }); } };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Host: accept cohost and mix streams
 * Host listens to cohost offer, answers, and receives remote tracks.
 * Then uses Canvas + WebAudio to create a composite stream and replaces
 * outbound video/audio track to viewers.
 * ────────────────────────────────────────────────────────────────────────── */
export type Mixer = ReturnType<typeof createAVMixer>;

export function createAVMixer(opts: { width?: number; height?: number; fps?: number }) {
  // Default to landscape 1280x720; host preview wants 16:9 medium and viewers expect landscape when broadcasting from PC
  const width = opts.width ?? 1280;
  const height = opts.height ?? 720;
  const fps = opts.fps ?? 30;

  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const videoA = document.createElement('video');
  videoA.muted = true; videoA.playsInline = true; videoA.autoplay = true;
  // Keep in DOM but completely offscreen to avoid any flash while allowing drawing
  videoA.style.cssText = 'position:fixed; left:-99999px; top:-99999px; width:1px; height:1px; opacity:0; pointer-events:none; z-index:-1;';
  const videoB = document.createElement('video');
  videoB.muted = true; videoB.playsInline = true; videoB.autoplay = true;
  videoB.style.cssText = 'position:fixed; left:-99999px; top:-99999px; width:1px; height:1px; opacity:0; pointer-events:none; z-index:-1;';
  document.body.appendChild(videoA); document.body.appendChild(videoB); // offscreen rendering
  // Ensure playback actually starts for captureStream to have frames
  try { videoA.play().catch(() => {}); } catch {}
  try { videoB.play().catch(() => {}); } catch {}

  // Audio mixing
  const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
  const dest = ac.createMediaStreamDestination();
  let sourceA: MediaStreamAudioSourceNode | null = null;
  let sourceB: MediaStreamAudioSourceNode | null = null;

  function setStreamA(s: MediaStream | null) {
    if (s) {
      videoA.srcObject = s;
      try { sourceA?.disconnect(); } catch {}
      try { sourceA = ac.createMediaStreamSource(s); sourceA.connect(dest); } catch {}
    } else {
      try { sourceA?.disconnect(); } catch {}
      sourceA = null; videoA.srcObject = null;
    }
  }
  function setStreamB(s: MediaStream | null) {
    if (s) {
      videoB.srcObject = s;
      try { sourceB?.disconnect(); } catch {}
      try { sourceB = ac.createMediaStreamSource(s); sourceB.connect(dest); } catch {}
    } else {
      try { sourceB?.disconnect(); } catch {}
      sourceB = null; videoB.srcObject = null;
    }
  }

  const drawOnce = () => {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, width, height);
    const halfW = Math.floor(width / 2);
    // Left: host A
    if (videoA.videoWidth && videoA.videoHeight) {
      const ratioA = Math.min(halfW / videoA.videoWidth, height / videoA.videoHeight);
      const wA = Math.floor(videoA.videoWidth * ratioA);
      const hA = Math.floor(videoA.videoHeight * ratioA);
      const xA = Math.floor((halfW - wA) / 2);
      const yA = Math.floor((height - hA) / 2);
      ctx.drawImage(videoA, xA, yA, wA, hA);
    }
    // Right: cohost B
    if (videoB.videoWidth && videoB.videoHeight) {
      const ratioB = Math.min(halfW / videoB.videoWidth, height / videoB.videoHeight);
      const wB = Math.floor(videoB.videoWidth * ratioB);
      const hB = Math.floor(videoB.videoHeight * ratioB);
      const xB = halfW + Math.floor((halfW - wB) / 2);
      const yB = Math.floor((height - hB) / 2);
      ctx.drawImage(videoB, xB, yB, wB, hB);
    }
  };

  // Prefer rAF for smoother composition and consistent frame pacing
  let rafId: number | null = null;
  const tick = () => {
    drawOnce();
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
  const mixedVideo = canvas.captureStream(fps);
  dest.stream.getAudioTracks().forEach((t) => mixedVideo.addTrack(t));

  const mixed = mixedVideo;
  function destroy() { try { if (rafId) cancelAnimationFrame(rafId); } catch {}; try { ac.close(); } catch {}; videoA.remove(); videoB.remove(); }

  return { setStreamA, setStreamB, mixed, destroy };
}

export async function hostAcceptCoHost(liveId: string, userId: string, onRemote: (s: MediaStream) => void) {
  const db = getFirestoreInstance();
  const pc = new RTCPeerConnection(getRtcConfig('broadcaster'));
  pc.ontrack = (e) => {
    const s = (e.streams && e.streams[0]) || new MediaStream([e.track]);
    onRemote(s);
  };
  pc.onicecandidate = async (e) => {
    if (!e.candidate) return;
    await addDoc(collection(db, 'liveStreams', liveId, 'cohosts', userId, 'candidates_out'), e.candidate.toJSON());
  };
  // Read cohost offer (subscribe to avoid race)
  const offerRef = doc(db, 'liveStreams', liveId, 'cohosts', userId, 'sdp', 'offer');
  const offerSnap: any = await new Promise((resolve, reject) => {
    const unsub = onSnapshot(offerRef as any, (snap: any) => {
      if (snap.exists()) { try { unsub(); } catch {}; resolve(snap); }
    }, reject);
  });
  await pc.setRemoteDescription(new RTCSessionDescription(offerSnap.data() as any));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await setDoc(doc(db, 'liveStreams', liveId, 'cohosts', userId, 'sdp', 'answer'), answer);

  // Consume ICE from cohost → candidates_in
  const unsubIn = onSnapshot(collection(db, 'liveStreams', liveId, 'cohosts', userId, 'candidates_in'), (snap: any) => {
    snap.docChanges().forEach((ch: any) => {
      if (ch.type !== 'added') return;
      const c = ch.doc.data();
      pc.addIceCandidate(new RTCIceCandidate(c)).catch((err) => console.error('host addIceCandidate failed', err));
    });
  });
  return { pc, cleanup: () => { try { unsubIn(); } catch {}; try { pc.close(); } catch {}; } };
}
