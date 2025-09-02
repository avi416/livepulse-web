// src/services/webrtcService.ts
import { doc, getDoc, onSnapshot, collection, addDoc, setDoc } from 'firebase/firestore';
import { safeUpdateLiveStream } from './streamService';
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
  console.log('[broadcasterPC] 🎛️ Created RTCPeerConnection for stream', streamId);

  const logSenders = (where: string) => {
    try {
      const kinds = pc.getSenders().map((s) => s.track?.kind || 'none');
      console.log(`[broadcasterPC] 🔎 senders @ ${where}:`, kinds);
    } catch {}
  };

  // הוסף רק track אחד מכל סוג – זה יצמצם תקלות
  const videoTrack = stream.getVideoTracks()[0] || null;
  const audioTrack = stream.getAudioTracks()[0] || null;

  if (videoTrack) {
    console.log('➕ Adding VIDEO track:', videoTrack.id, {
      enabled: videoTrack.enabled,
      muted: videoTrack.muted,
      readyState: videoTrack.readyState,
    });
    // Ensure only one video sender; reuse existing transceiver if present
    let vTrans = pc.getTransceivers().find((t) => t.sender.track?.kind === 'video' || t.receiver.track?.kind === 'video');
    if (!vTrans) {
      try { vTrans = pc.addTransceiver('video', { direction: 'sendonly' }); } catch {}
    }
    const sender = vTrans?.sender || pc.addTrack(videoTrack, stream);
    try { await sender.replaceTrack(videoTrack); } catch {}
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
    // Ensure only one audio sender; reuse existing transceiver if present
    let aTrans = pc.getTransceivers().find((t) => t.sender.track?.kind === 'audio' || t.receiver.track?.kind === 'audio');
    if (!aTrans) {
      try { aTrans = pc.addTransceiver('audio', { direction: 'sendonly' }); } catch {}
    }
    const aSender = aTrans?.sender || pc.addTrack(audioTrack, stream);
    try { await aSender.replaceTrack(audioTrack); } catch {}
  } else {
    console.warn('⚠️ No local AUDIO track found');
  }

  logSenders('after attach local tracks');

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
  console.log('[broadcasterPC] 📝 Creating broadcaster offer…');
  let makingOffer = false;
  makingOffer = true;
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  makingOffer = false;

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
      if (makingOffer) return;
      makingOffer = true;
      console.log('[broadcasterPC] 🧩 negotiationneeded → creating new offer');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await setDoc(doc(getFirestoreInstance(), 'liveStreams', liveId, 'sdp', 'offer'), offer);
      console.log('[broadcasterPC] 🧩 negotiationcompleted');
    } catch (e) {
      console.error('❌ negotiationneeded failed:', e);
    }
    finally { makingOffer = false; }
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
  // Periodically confirm we still have active senders
  setInterval(() => logSenders('periodic'), 5000);

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

  // קבלת Tracks מהשדר – שמירה על Stream יציב והוספת מסלולים לפי סוג
  pc.ontrack = (e) => {
    console.log('📡 Viewer received track:', e.track.kind, {
      muted: e.track.muted,
      readyState: e.track.readyState,
    });

    // נשתמש ב־MediaStream יציב שמחובר ל-videoEl ונוסיף/נחליף מסלולים לפי kind
    let composite: MediaStream | null = null;
    if (videoEl.srcObject instanceof MediaStream) {
      composite = videoEl.srcObject as MediaStream;
    } else if (e.streams && e.streams[0]) {
      // התחל מ-stream הנכנס אבל אל תדרוס אותו בהמשך
      composite = new MediaStream();
    } else {
      composite = new MediaStream();
    }

    const kind = e.track.kind;
    const existingTracks = composite.getTracks();
    const existingOfKind = existingTracks.filter((t) => t.kind === kind);

    // אם כבר יש מסלול מאותו סוג – החלפה נקייה ב־replace semantics
    if (existingOfKind.length > 0) {
      existingOfKind.forEach((t) => composite!.removeTrack(t));
    }
    try {
      composite.addTrack(e.track);
    } catch (err) {
      console.warn('⚠️ Failed to add track to composite stream', err);
    }

    if (videoEl.srcObject !== composite) {
      videoEl.srcObject = composite;
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
  console.log('[hostPC] 🎛️ Created RTCPeerConnection for co-host session', { streamId, coHostId });

  const logSenders = (where: string) => {
    try {
      const kinds = pc.getSenders().map((s) => s.track?.kind || 'none');
      console.log(`[hostPC] 🔎 senders @ ${where}:`, kinds);
    } catch {}
  };
  
  // Ensure sendrecv transceivers
  const vT = pc.addTransceiver('video', { direction: 'sendrecv' });
  const aT = pc.addTransceiver('audio', { direction: 'sendrecv' });
  try { preferH264IfConfigured(vT); } catch {}
  try { preferH264IfConfigured(vT); } catch {}

  // Attach host local tracks (host preview stays connected directly to localStream via UI)
  const v = localStream.getVideoTracks()[0];
  const a = localStream.getAudioTracks()[0];
  if (v) {
    try {
      if ((v as MediaStreamTrack).readyState !== 'live') {
        console.warn('[hostPC] video track not live:', (v as MediaStreamTrack).readyState);
      }
      (v as MediaStreamTrack).enabled = true;
      await vT.sender.replaceTrack(v);
    } catch (e) { console.warn('replaceTrack(video) failed', e); }
  }
  if (a) {
    try {
      if ((a as MediaStreamTrack).readyState !== 'live') {
        console.warn('[hostPC] audio track not live:', (a as MediaStreamTrack).readyState);
      }
      (a as MediaStreamTrack).enabled = true;
      await aT.sender.replaceTrack(a);
    } catch (e) { console.warn('replaceTrack(audio) failed', e); }
  }
  logSenders('after attach local (sendrecv)');
  
  // Make sure we have a valid stream with tracks to send
  if (localStream.getTracks().length === 0) {
    console.error('⚠️ Host has no tracks to send to co-host!');
  } else {
    console.log('✅ Host has', localStream.getTracks().length, 'tracks to send to co-host');
  }
  
  // Remote co-host stream → rendered only in remoteVideoEl
  pc.ontrack = (event) => {
    const el = remoteVideoEl;
    const kind = event.track.kind;
    console.log('📡 Host received track from co-host:', kind, {
      readyState: event.track.readyState,
      muted: event.track.muted,
    });

    // 1) Stable composite
    let composite: MediaStream;
    if (el.srcObject instanceof MediaStream) {
      composite = el.srcObject as MediaStream;
    } else {
      composite = new MediaStream();
    }

    // 2) Replace only same-kind
    composite
      .getTracks()
      .filter((t) => t.kind === kind)
      .forEach((t) => { try { composite.removeTrack(t); } catch {} });
    try { composite.addTrack(event.track); } catch (e) { console.warn('addTrack failed', e); }

    // 3) Bind and prep for autoplay
    if (el.srcObject !== composite) el.srcObject = composite;
    el.autoplay = true;
    el.playsInline = true;
    el.muted = true; // allow autoplay; provide separate UI to unmute if needed
    try { el.removeAttribute('controls'); } catch {}
    try {
      if (!el.style.width) el.style.width = '360px';
      el.style.maxWidth = '100%';
      el.style.objectFit = 'contain';
    } catch {}

    const tryPlay = () => el.play().catch(() => {
      const resume = () => { el.play().catch(() => {}); cleanup(); };
      const cleanup = () => ['click','touchstart','keydown'].forEach(ev => window.removeEventListener(ev, resume));
      ['click','touchstart','keydown'].forEach(ev => window.addEventListener(ev, resume, { once: true }));
    });
    tryPlay();

    // log track counts
  const vids = composite.getVideoTracks().length;
  const auds = composite.getAudioTracks().length;
  console.log('[host] ontrack', { kind, vids, auds, trackId: event.track.id });
  };

  // Periodic inbound stats
  const statsTimer = setInterval(async () => {
    try {
      const stats = await pc.getStats();
      let frames = 0, width = 0, height = 0;
      stats.forEach((r: any) => {
        if (r.type === 'inbound-rtp' && r.kind === 'video') {
          frames = r.framesDecoded || frames;
        }
        if (r.type === 'track' && r.kind === 'video') {
          width = r.frameWidth || width;
          height = r.frameHeight || height;
        }
      });
      console.log('[host] inbound stats', { framesDecoded: frames, frameSize: width && height ? `${width}x${height}` : undefined });
    } catch {}
  }, 5000);
  
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

  // Perfect negotiation flags
  let makingOffer = false;
  pc.onnegotiationneeded = async () => {
    if (makingOffer) return;
    makingOffer = true;
    try {
      console.log('[hostPC] 🧩 negotiationneeded (noop-answerer): keeping existing description to avoid glare');
      // As the answerer, we avoid generating offers here to prevent glare.
    } finally { makingOffer = false; }
  };

  // Wait for co-host offer
  const liveStreamDoc = doc(db, 'liveStreams', streamId);
  const cohostDoc = doc(collection(liveStreamDoc, 'cohost'), coHostId);
  let offerData;
  
  // First, ensure the stream is still marked as live
  try {
    const streamDocSnap = await getDoc(liveStreamDoc);
    if (streamDocSnap.exists()) {
      const streamData = streamDocSnap.data();
      if (streamData.status !== 'live') {
        console.warn(`⚠️ Stream status is ${streamData.status}, attempting to fix...`);
        
        // Force update the stream status back to live
        const { serverTimestamp } = await import('firebase/firestore');
        await safeUpdateLiveStream(streamId, {
          status: 'live',
          lastSeen: serverTimestamp(),
          updatedAt: serverTimestamp(),
          hasCoHost: true
        });
        console.log('✅ Stream status corrected to live');
      }
    }
  } catch (err) {
    console.error('❌ Failed to verify stream status:', err);
    // Continue anyway as this is just a precaution
  }
  
  // Check if offer already exists or wait for it
  const cohostSnap = await getDoc(cohostDoc);
  if (cohostSnap.exists() && cohostSnap.data().offer) {
    console.log('✅ Found existing co-host offer');
    offerData = cohostSnap.data().offer;
  } else {
    console.log('⏳ Waiting for co-host offer...');
    
    // Notify that we're waiting for the offer
    try {
      await setDoc(cohostDoc, { 
        hostWaiting: true, 
        timestamp: new Date().toISOString(),
        streamStatus: 'live' // Include stream status for co-host to see
      }, { merge: true });
    } catch (err) {
      console.warn('⚠️ Failed to update waiting status:', err);
      // Continue anyway as this is just a notification
    }
    
    // Wait for offer with an extended timeout (30 seconds)
    offerData = await new Promise((resolve, reject) => {
      const unsubscribe = onSnapshot(cohostDoc, (snap: any) => {
        if (snap.exists() && snap.data().offer) {
          const data = snap.data().offer;
          console.log('✅ Received co-host offer data');
          unsubscribe();
          resolve(data);
        }
      });
      
      // Set timeout to prevent waiting forever - increased to 30 seconds
      const timeoutId = setTimeout(() => {
        unsubscribe();
        reject(new Error('Timeout waiting for co-host offer (30s). Co-host may be offline or having connection issues.'));
      }, 30000);
      
      return () => {
        clearTimeout(timeoutId);
        unsubscribe();
      };
    }).catch(err => {
      console.error('❌ Error waiting for co-host offer:', err);
      throw err;
    });
  }
  
  // Set remote description from offer
  try {
    console.log('[hostPC] 📝 Setting remote description from co-host offer');
    await pc.setRemoteDescription(new RTCSessionDescription(offerData as RTCSessionDescriptionInit));
  } catch (err) {
    console.error('❌ Failed to set remote description:', err);
    
    // Notify co-host about the error
    try {
      await setDoc(cohostDoc, { 
        hostError: `Failed to process your offer: ${err instanceof Error ? err.message : 'Unknown error'}`,
        errorTimestamp: new Date().toISOString()
      }, { merge: true });
    } catch (updateErr) {
      console.error('❌ Could not update error status:', updateErr);
    }
    
    throw err;
  }
  
  // Create and set answer
  try {
    console.log('[hostPC] 📝 Creating answer for co-host');
    makingOffer = true;
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    makingOffer = false;
    
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
    
    // Include a timestamp with the answer
    const answerWithTimestamp = {
      ...answer,
      timestamp: new Date().toISOString()
    };
    
    await setDoc(cohostDoc, { 
      answer: answerWithTimestamp,
      hostConnected: true,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    console.log('✅ Answer sent to co-host successfully');
  } catch (err) {
    console.error('❌ Failed to create or send answer:', err);
    
    // Notify co-host about the error
    try {
      const liveStreamDoc = doc(db, 'liveStreams', streamId);
      const cohostDoc = doc(collection(liveStreamDoc, 'cohost'), coHostId);
      
      await setDoc(cohostDoc, { 
        hostError: `Failed to create or send answer: ${err instanceof Error ? err.message : 'Unknown error'}`,
        errorTimestamp: new Date().toISOString(),
        hostConnected: false
      }, { merge: true });
      
      console.log('✅ Error status updated for co-host');
    } catch (updateErr) {
      console.error('❌ Could not update error status:', updateErr);
    }
    
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
  pc.onconnectionstatechange = async () => {
    console.log('🔗 Host-CoHost connection state:', pc.connectionState);
    logSenders(`onconnectionstatechange:${pc.connectionState}`);
    
    try {
      // Update connection state in Firestore for the co-host to see
      const liveStreamDoc = doc(db, 'liveStreams', streamId);
      const cohostDoc = doc(collection(liveStreamDoc, 'cohost'), coHostId);
      
      await setDoc(cohostDoc, { 
        hostConnectionState: pc.connectionState,
        connectionStateTimestamp: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.warn('⚠️ Failed to update connection state:', err);
    }
    
    if (pc.connectionState === 'connected') {
      console.log('✅ Host-CoHost connection established successfully');
    } else if (pc.connectionState === 'disconnected' || 
               pc.connectionState === 'failed' || 
               pc.connectionState === 'closed') {
      console.log('⚠️ Co-host connection ended or failed');
      
      try {
        // Notify co-host that connection is ended from host side
        const liveStreamDoc = doc(db, 'liveStreams', streamId);
        const cohostDoc = doc(collection(liveStreamDoc, 'cohost'), coHostId);
        
        await setDoc(cohostDoc, { 
          hostConnectionEnded: true,
          hostConnectionState: pc.connectionState,
          connectionStateTimestamp: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.warn('⚠️ Failed to update connection end state:', err);
      }
    }
  };
  
  // ICE connection state monitoring
  pc.oniceconnectionstatechange = async () => {
    console.log('🧊 Host-CoHost ICE state:', pc.iceConnectionState);
    
    try {
      // Update ICE state in Firestore
      const liveStreamDoc = doc(db, 'liveStreams', streamId);
      const cohostDoc = doc(collection(liveStreamDoc, 'cohost'), coHostId);
      
      await setDoc(cohostDoc, { 
        hostIceState: pc.iceConnectionState,
        iceStateTimestamp: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.warn('⚠️ Failed to update ICE state:', err);
    }
    
    if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
      console.warn('⚠️ Co-host ICE connection issue');
    }
  };
  
  return {
    pc,
    cleanup: () => {
      try {
  unsubCoHostCandidates();
  clearInterval(statsTimer);
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
  console.log('[cohostPC] 🎛️ Created RTCPeerConnection for co-host joining', { streamId, coHostId });

  const logSenders = (where: string) => {
    try {
      const kinds = pc.getSenders().map((s) => s.track?.kind || 'none');
      console.log(`[cohostPC] 🔎 senders @ ${where}:`, kinds);
    } catch {}
  };
  
  // Ensure sendrecv transceivers
  const vT = pc.addTransceiver('video', { direction: 'sendrecv' });
  const aT = pc.addTransceiver('audio', { direction: 'sendrecv' });

  // Attach local co-host tracks
  const v = localStream.getVideoTracks()[0];
  const a = localStream.getAudioTracks()[0];
  if (!v) {
    throw new Error('No local video track');
  }
  if ((v as MediaStreamTrack).readyState !== 'live') {
    throw new Error(`Video track not live: ${(v as MediaStreamTrack).readyState}`);
  }
  if (v) {
    try {
      if ((v as MediaStreamTrack).readyState !== 'live') {
        console.warn('[cohostPC] video track not live:', (v as MediaStreamTrack).readyState);
      }
      (v as MediaStreamTrack).enabled = true;
      const vSender = pc.getSenders().find((s) => s.track?.kind === 'video') || vT.sender;
      await vSender.replaceTrack(v);
    } catch (e) { console.warn('replaceTrack(video) failed', e); }
  }
  if (a) {
    try {
      if ((a as MediaStreamTrack).readyState !== 'live') {
        console.warn('[cohostPC] audio track not live:', (a as MediaStreamTrack).readyState);
      }
      (a as MediaStreamTrack).enabled = true;
      const aSender = pc.getSenders().find((s) => s.track?.kind === 'audio') || aT.sender;
      await aSender.replaceTrack(a);
    } catch (e) { console.warn('replaceTrack(audio) failed', e); }
  }
  logSenders('after attach local (sendrecv)');
  
  // Make sure we have a valid stream with tracks to send
  if (localStream.getTracks().length === 0) {
    console.error('⚠️ Co-host has no tracks to send to host!');
  } else {
    console.log('✅ Co-host has', localStream.getTracks().length, 'tracks to send to host');
  }
  
  // Remote HOST stream → rendered only in hostVideoEl
  pc.ontrack = (event) => {
    const el = hostVideoEl;
    const kind = event.track.kind;
    console.log('📡 Co-Host received track from host:', kind, {
      readyState: event.track.readyState,
      muted: event.track.muted,
    });

    // 1) Stable composite
    let composite: MediaStream;
    if (el.srcObject instanceof MediaStream) {
      composite = el.srcObject as MediaStream;
    } else {
      composite = new MediaStream();
    }

    // 2) Replace only same-kind
    composite
      .getTracks()
      .filter((t) => t.kind === kind)
      .forEach((t) => { try { composite.removeTrack(t); } catch {} });
    try { composite.addTrack(event.track); } catch (e) { console.error('addTrack failed', e); }

    // 3) Bind and prep for autoplay
    if (el.srcObject !== composite) el.srcObject = composite;
    el.autoplay = true;
    el.playsInline = true;
    el.muted = true; // allow autoplay; can show unmute button in UI
    try { el.removeAttribute('controls'); } catch {}

    const tryPlay = () => el.play().catch(() => {
      const resume = () => { el.play().catch(() => {}); cleanup(); };
      const cleanup = () => ['click','touchstart','keydown'].forEach(ev => window.removeEventListener(ev, resume));
      ['click','touchstart','keydown'].forEach(ev => window.addEventListener(ev, resume, { once: true }));
    });
    tryPlay();

    // log track counts
    const vids = composite.getVideoTracks().length;
    const auds = composite.getAudioTracks().length;
    console.log('[cohost] ontrack:', kind, { vids, auds });
  };

  // Periodic inbound stats
  const statsTimer = setInterval(async () => {
    try {
      const stats = await pc.getStats();
      let frames = 0, width = 0, height = 0;
      stats.forEach((r: any) => {
        if (r.type === 'inbound-rtp' && r.kind === 'video') {
          frames = r.framesDecoded || frames;
        }
        if (r.type === 'track' && r.kind === 'video') {
          width = r.frameWidth || width;
          height = r.frameHeight || height;
        }
      });
      console.log('[cohost] inbound stats', { framesDecoded: frames, frameSize: width && height ? `${width}x${height}` : undefined });
    } catch {}
  }, 5000);
  
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

  // Perfect negotiation flags
  let makingOffer = false;
  pc.onnegotiationneeded = async () => {
    if (makingOffer) return;
    makingOffer = true;
    try {
      console.log('[cohostPC] 🧩 negotiationneeded (noop): renegotiation not wired to Firestore updates; skipping');
      // Note: renegotiation offers are not propagated in current signaling flow.
    } finally { makingOffer = false; }
  };

  // Create and send offer to host
  try {
    console.log('[cohostPC] 📝 Creating offer for host');
    makingOffer = true;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    makingOffer = false;
    
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

  // Check if the host is online by verifying stream status
  try {
    const streamDoc = await getDoc(doc(db, 'liveStreams', streamId));
    if (!streamDoc.exists()) {
      throw new Error('Stream not found');
    }
    
    const streamData = streamDoc.data();
    if (streamData.status !== 'live') {
      throw new Error(`Stream is not live (status: ${streamData.status})`);
    }
    
    // Log the host details to help with debugging
    console.log('✅ Stream is live, host should be available:', {
      streamId,
      hostUid: streamData.uid,
      status: streamData.status
    });
  } catch (error) {
    console.error('❌ Error checking stream status:', error);
    throw new Error('Could not verify if stream is active');
  }
  
  // Send notification to the database that a co-host is waiting
  try {
    await setDoc(cohostDoc, { 
      waitingForAnswer: true, 
      timestamp: new Date().toISOString(),
      updated: Date.now()
    }, { merge: true });
    console.log('📣 Notification sent to host about waiting co-host');
  } catch (error) {
    console.error('⚠️ Failed to notify host:', error);
    // Continue anyway, this is just an extra notification
  }
  
  const answerData = await new Promise((resolve, reject) => {
    // Create a map to track changes to avoid processing the same snapshot multiple times
    const processedSnapshots = new Map();
    
    const unsubscribe = onSnapshot(cohostDoc, (snap: any) => {
      if (!snap.exists()) return;
      
      const data = snap.data();
      const snapId = snap.id + (data.updatedAt || data.timestamp || Date.now());
      
      // If we've already processed this exact snapshot, ignore it
      if (processedSnapshots.has(snapId)) return;
      processedSnapshots.set(snapId, true);
      
      // Check for host errors
      if (data.hostError) {
        console.error('❌ Host reported an error:', data.hostError);
        unsubscribe();
        reject(new Error(`Host error: ${data.hostError}`));
        return;
      }
      
      // Check for answer
      if (data.answer) {
        console.log('✅ Received answer from host:', !!data.answer);
        unsubscribe();
        resolve(data.answer);
        return;
      }
    });
    
    // Set timeout to prevent waiting forever - increased to 45 seconds
    const timeoutDuration = 45000; // 45 seconds
    console.log(`⏱️ Setting timeout for ${timeoutDuration/1000} seconds`);
    
    // Send periodic pings to keep the connection alive
    const pingInterval = setInterval(async () => {
      try {
        await setDoc(cohostDoc, { 
          ping: new Date().toISOString(),
          waitingForAnswer: true
        }, { merge: true });
        console.log('📣 Ping sent to host');
      } catch (err) {
        console.warn('⚠️ Failed to send ping:', err);
      }
    }, 10000); // every 10 seconds
    
    const timeout = setTimeout(() => {
      clearInterval(pingInterval);
      unsubscribe();
      reject(new Error('Timeout waiting for host answer (45s). Host may be offline or busy.'));
    }, timeoutDuration);
    
    return () => {
      clearTimeout(timeout);
      clearInterval(pingInterval);
      unsubscribe();
    };
  }).catch(err => {
    console.error('❌ Error waiting for host answer:', err);
    throw err;
  });
  
  // Set remote description from answer
  try {
    console.log('[cohostPC] 📝 Setting remote description from host answer');
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
  pc.onconnectionstatechange = async () => {
    console.log('🔗 CoHost-Host connection state:', pc.connectionState);
    logSenders(`onconnectionstatechange:${pc.connectionState}`);
    
    try {
      // Update connection state in Firestore
      const liveStreamDoc = doc(db, 'liveStreams', streamId);
      const cohostDoc = doc(collection(liveStreamDoc, 'cohost'), coHostId);
      
      await setDoc(cohostDoc, { 
        cohostConnectionState: pc.connectionState,
        connectionStateTimestamp: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.warn('⚠️ Failed to update connection state:', err);
    }
    
    if (pc.connectionState === 'connected') {
      console.log('✅ CoHost-Host connection established successfully');
    } else if (pc.connectionState === 'disconnected' || 
               pc.connectionState === 'failed' || 
               pc.connectionState === 'closed') {
      console.log('⚠️ Host connection ended or failed:', pc.connectionState);
      
      try {
        // Notify about connection end
        const liveStreamDoc = doc(db, 'liveStreams', streamId);
        const cohostDoc = doc(collection(liveStreamDoc, 'cohost'), coHostId);
        
        await setDoc(cohostDoc, { 
          cohostConnectionEnded: true,
          cohostConnectionState: pc.connectionState,
          connectionStateTimestamp: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.warn('⚠️ Failed to update connection end state:', err);
      }
    }
  };
  
  // ICE connection state monitoring
  pc.oniceconnectionstatechange = async () => {
    console.log('🧊 CoHost-Host ICE state:', pc.iceConnectionState);
    
    try {
      // Update ICE state in Firestore
      const liveStreamDoc = doc(db, 'liveStreams', streamId);
      const cohostDoc = doc(collection(liveStreamDoc, 'cohost'), coHostId);
      
      await setDoc(cohostDoc, { 
        cohostIceState: pc.iceConnectionState,
        iceStateTimestamp: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.warn('⚠️ Failed to update ICE state:', err);
    }
    
    if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
      console.warn('⚠️ Host ICE connection issue:', pc.iceConnectionState);
    }
  };
  
  return {
    pc,
    cleanup: () => {
      try {
  unsubHostCandidates();
  clearInterval(statsTimer);
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