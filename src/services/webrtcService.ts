import { collection, doc, setDoc, onSnapshot, addDoc, getDoc } from 'firebase/firestore';
import { getFirestoreInstance } from './firebase';

/*
  webrtcService: helpers to create RTCPeerConnection and use Firestore for signalling.
  - broadcaster creates offer, writes to webrtcSignals/{streamId}
  - offers ICE under webrtcSignals/{streamId}/offerCandidates
  - watchers create answer, write to webrtcSignals/{streamId}
  - watchers write ICE under .../answerCandidates

  This is a demo signalling implementation suitable for prototyping.
*/

const configuration: RTCConfiguration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

export function createBroadcasterPC(stream: MediaStream | null, streamId: string, onRemoteTrack?: (s: MediaStream) => void) {
  const pc = new RTCPeerConnection(configuration);
  if (stream) stream.getTracks().forEach(t => pc.addTrack(t, stream));

  pc.ontrack = (event: RTCTrackEvent) => {
    if (onRemoteTrack && event.streams && event.streams[0]) onRemoteTrack(event.streams[0]);
  };

  const db = getFirestoreInstance();
  const roomRef = doc(collection(db, 'webrtcSignals'), streamId);
  const offerCandidatesCol = collection(roomRef, 'offerCandidates');
  const answerCandidatesCol = collection(roomRef, 'answerCandidates');

  pc.onicecandidate = async (event: RTCPeerConnectionIceEvent) => {
    if (!event.candidate) return;
    await addDoc(offerCandidatesCol, event.candidate.toJSON());
  };

  return { pc, roomRef, offerCandidatesCol, answerCandidatesCol };
}

export async function broadcasterCreateOffer(broadcaster: ReturnType<typeof createBroadcasterPC>) {
  const { pc, roomRef, answerCandidatesCol } = broadcaster;
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  await setDoc(roomRef, { type: 'offer', sdp: offer.sdp });

  const unsub = onSnapshot(roomRef, async (snap: any) => {
    const data = snap.data() as any;
    if (!data) return;
    if (data.type === 'answer' && data.sdp) {
      const answer = { type: 'answer', sdp: data.sdp } as RTCSessionDescriptionInit;
      await pc.setRemoteDescription(answer);
    }
  });

  const unsubIce = onSnapshot(answerCandidatesCol, (snap: any) => {
    snap.docChanges().forEach((change: any) => {
      if (change.type === 'added') {
        const c = change.doc.data() as any;
        pc.addIceCandidate(new RTCIceCandidate(c));
      }
    });
  });

  return { unsub, unsubIce };
}

export async function watcherJoin(streamId: string, videoEl: HTMLVideoElement, localStream: MediaStream | null) {
  const pc = new RTCPeerConnection(configuration);

  if (localStream) localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

  const db = getFirestoreInstance();
  const roomRef = doc(collection(db, 'webrtcSignals'), streamId);
  const offerCandidatesCol = collection(roomRef, 'offerCandidates');
  const answerCandidatesCol = collection(roomRef, 'answerCandidates');

  pc.ontrack = (event: RTCTrackEvent) => {
    videoEl.srcObject = event.streams[0];
    videoEl.play().catch(() => {});
  };

  pc.onicecandidate = async (event: RTCPeerConnectionIceEvent) => {
    if (!event.candidate) return;
    await addDoc(answerCandidatesCol, event.candidate.toJSON());
  };

  const snap = await getDoc(roomRef);
  const data = snap.data() as any;
  if (!data || data.type !== 'offer') throw new Error('Offer not found');

  const offerDesc = { type: 'offer', sdp: data.sdp } as RTCSessionDescriptionInit;
  await pc.setRemoteDescription(offerDesc);

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  await setDoc(roomRef, { type: 'answer', sdp: answer.sdp });

  const unsubOfferIce = onSnapshot(offerCandidatesCol, (snap2: any) => {
    snap2.docChanges().forEach((change: any) => {
      if (change.type === 'added') {
        const c = change.doc.data() as any;
        pc.addIceCandidate(new RTCIceCandidate(c));
      }
    });
  });

  return { pc, unsubOfferIce };
}
