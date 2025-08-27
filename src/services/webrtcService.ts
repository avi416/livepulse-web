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
 * תאימות לאחור
 * ────────────────────────────────────────────────────────────────────────── */
export async function broadcasterCreateOffer(broadcaster: ReturnType<typeof createBroadcasterPC>) {
  return broadcaster;
}
export async function watcherJoin(streamId: string, videoEl: HTMLVideoElement) {
  return await connectAsViewer(streamId, videoEl);
}
