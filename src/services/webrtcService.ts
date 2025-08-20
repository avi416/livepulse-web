// src/services/webrtcService.ts
import {
  doc, getDoc, onSnapshot, collection, addDoc, setDoc,
  type DocumentData, type DocumentSnapshot, type QuerySnapshot, type DocumentChange
} from 'firebase/firestore';
import { getFirestoreInstance } from './firebase';

const iceServers: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// ── Broadcaster ─────────────────────────────────────────────────────────────
export async function createBroadcasterPC(
  stream: MediaStream,
  streamId: string,
  onRemoteTrack?: (s: MediaStream) => void
) {
  if (!stream || !(stream instanceof MediaStream)) {
    console.error('⚠️ createBroadcasterPC called without valid MediaStream!', stream);
    throw new Error('❌ Broadcaster must be started with a valid MediaStream');
  }

  console.log('🎥 Creating broadcaster PC for stream:', streamId);
  console.log('📹 Local tracks:', stream.getTracks().map(t => ({
    kind: t.kind, id: t.id, enabled: t.enabled, muted: t.muted, readyState: t.readyState
  })));

  const pc = new RTCPeerConnection({ iceServers });

  const videoTrack = stream.getVideoTracks()[0] || null;
  const audioTrack = stream.getAudioTracks()[0] || null;

  if (videoTrack) {
    console.log('➕ Adding VIDEO track:', videoTrack.id, {
      enabled: videoTrack.enabled, muted: videoTrack.muted, readyState: videoTrack.readyState,
    });
    pc.addTrack(videoTrack, stream);
  } else {
    console.warn('⚠️ No local VIDEO track found');
  }

  if (audioTrack) {
    console.log('➕ Adding AUDIO track:', audioTrack.id, {
      enabled: audioTrack.enabled, muted: audioTrack.muted, readyState: audioTrack.readyState,
    });
    pc.addTrack(audioTrack, stream);
  } else {
    console.warn('⚠️ No local AUDIO track found');
  }

  pc.ontrack = (event: RTCTrackEvent) => {
    console.log('📡 Broadcaster got remote track (loopback?):', event.track.kind, {
      readyState: event.track.readyState, muted: event.track.muted,
    });
    if (onRemoteTrack && event.streams && event.streams[0]) onRemoteTrack(event.streams[0]);
  };

  const db = getFirestoreInstance();
  const liveId = streamId;

  pc.onicecandidate = async (e) => {
    if (e.candidate) {
      try {
        console.log('🧊 Broadcaster ICE candidate:', e.candidate.candidate);
        await addDoc(collection(db, 'liveStreams', liveId, 'candidates_broadcaster'), e.candidate.toJSON());
      } catch (err) {
        console.error('❌ Failed to add broadcaster ICE candidate:', err);
      }
    }
  };

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

  const unsubAnswer = onSnapshot(
    doc(getFirestoreInstance(), 'liveStreams', liveId, 'sdp', 'answer'),
    async (snap: DocumentSnapshot<DocumentData>) => {
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
    }
  );

  const unsubViewerICE = onSnapshot(
    collection(getFirestoreInstance(), 'liveStreams', liveId, 'candidates_viewers'),
    (snap: QuerySnapshot<DocumentData>) => {
      snap.docChanges().forEach((change: DocumentChange<DocumentData>) => {
        if (change.type === 'added') {
          const c = change.doc.data();
          console.log('🧊 Adding viewer ICE candidate:', c.candidate);
          pc.addIceCandidate(new RTCIceCandidate(c)).catch((err) => {
            console.error('❌ Failed to add viewer ICE candidate:', err);
          });
        }
      });
    }
  );

  pc.onconnectionstatechange = () => {
    console.log('🔗 Broadcaster connection state:', pc.connectionState);
  };
  pc.oniceconnectionstatechange = () => {
    console.log('🧊 Broadcaster ICE state:', pc.iceConnectionState);
  };

  return { pc, unsubAnswer, unsubViewerICE };
}

// ── Viewer ────────────────────────────────────────────────────────────────
export async function connectAsViewer(liveId: string, videoEl: HTMLVideoElement) {
  console.log('👁️ Connecting as viewer to stream:', liveId);

  const db = getFirestoreInstance();
  const liveRef = doc(db, 'liveStreams', liveId);
  const liveSnap = await getDoc(liveRef);
  if (!liveSnap.exists()) throw new Error('Live not found');
  const live = liveSnap.data() as any;
  if (live.status !== 'live') throw new Error('Live has ended');

  const offerRef = doc(db, 'liveStreams', liveId, 'sdp', 'offer');
  const offerSnap = await getDoc(offerRef);
  if (!offerSnap.exists()) throw new Error('Offer not found');
  const offer = offerSnap.data();

  const pc = new RTCPeerConnection({ iceServers });

  function tryPlay(video: HTMLVideoElement) {
    video.play().then(() => {
      console.log('▶️ Video started automatically');
    }).catch(err => {
      console.warn('⚠️ Autoplay blocked, waiting for user gesture:', err);
      const resume = () => {
        video.play().catch(e => console.warn('❌ Still failed to play:', e));
        window.removeEventListener('click', resume);
        window.removeEventListener('touchstart', resume);
        window.removeEventListener('keydown', resume);
      };
      window.addEventListener('click', resume, { once: true });
      window.addEventListener('touchstart', resume, { once: true });
      window.addEventListener('keydown', resume, { once: true });
    });
  }

  pc.ontrack = (e) => {
    console.log('📡 Viewer received track:', e.track.kind, {
      muted: e.track.muted, readyState: e.track.readyState,
    });
    const incoming = e.streams && e.streams[0];
    if (incoming) {
      if (videoEl.srcObject !== incoming) {
        console.log('🎥 Using e.streams[0]');
        videoEl.srcObject = incoming;
      }
      videoEl.autoplay = true;
      videoEl.playsInline = true;
      videoEl.controls = true;
      videoEl.muted = true; // לאפשר autoplay
      tryPlay(videoEl);
    }
  };

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

  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  try {
    await setDoc(doc(db, 'liveStreams', liveId, 'sdp', 'answer'), answer);
    console.log('✅ Viewer answer saved');
  } catch (err) {
    console.error('❌ Failed to save answer:', err);
    throw err;
  }

  const unsubBroadcasterICE = onSnapshot(
    collection(db, 'liveStreams', liveId, 'candidates_broadcaster'),
    (snap: QuerySnapshot<DocumentData>) => {
      snap.docChanges().forEach((change: DocumentChange<DocumentData>) => {
        if (change.type === 'added') {
          const c = change.doc.data();
          console.log('🧊 Adding broadcaster ICE candidate:', c.candidate);
          pc.addIceCandidate(new RTCIceCandidate(c)).catch((err) => {
            console.error('❌ Failed to add broadcaster ICE candidate:', err);
          });
        }
      });
    }
  );

  pc.onconnectionstatechange = () => {
    console.log('🔗 Viewer connection state:', pc.connectionState);
  };
  pc.oniceconnectionstatechange = () => {
    console.log('🧊 Viewer ICE state:', pc.iceConnectionState);
  };

  const cleanup = () => {
    try { unsubBroadcasterICE(); } catch {}
    try { pc.close(); } catch {}
  };

  return { pc, cleanup };
}

// תאימות לאחור
export async function broadcasterCreateOffer(broadcaster: ReturnType<typeof createBroadcasterPC>) {
  return broadcaster;
}
export async function watcherJoin(streamId: string, videoEl: HTMLVideoElement) {
  return await connectAsViewer(streamId, videoEl);
}
