import { useEffect, useRef, useState } from 'react';
import { createAVMixer, hostAcceptCoHost } from '../services/webrtcService';

export function useCoHostMixer(liveId: string, coHostUserId: string, hostLocal: MediaStream | null, broadcasterPC: RTCPeerConnection | null) {
  const mixerRef = useRef<ReturnType<typeof createAVMixer> | null>(null);
  const [connected, setConnected] = useState(false);
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const [mixed, setMixed] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (!hostLocal || !broadcasterPC) return;
    const mixer = createAVMixer({});
    mixer.setStreamA(hostLocal);
    mixerRef.current = mixer;

    // Replace outbound video/audio with mixed
    const vSender = broadcasterPC.getSenders().find(s => s.track && s.track.kind === 'video');
    const aSender = broadcasterPC.getSenders().find(s => s.track && s.track.kind === 'audio');
  const mixedOut = mixer.mixed;
  setMixed(mixedOut);
  const vTrack = mixedOut.getVideoTracks()[0];
  const aTrack = mixedOut.getAudioTracks()[0];
    if (vSender && vTrack) vSender.replaceTrack(vTrack).catch(() => {});
    if (aSender && aTrack) aSender.replaceTrack(aTrack).catch(() => {});

    // Listen for a single cohost connection
    let pc: RTCPeerConnection | null = null;
  let closer: (() => void) | null = null;
  hostAcceptCoHost(liveId, coHostUserId, (remoteStream) => {
      setRemote(remoteStream);
      mixer.setStreamB(remoteStream);
      setConnected(true);
    }).then((res) => {
      pc = res.pc;
      closer = res.cleanup || null;
    }).catch(() => {});

    return () => {
  try { closer?.(); } catch {}
  try { pc?.close(); } catch {}
    mixer.destroy();
      mixerRef.current = null;
    setRemote(null);
    setMixed(null);
    };
  }, [liveId, coHostUserId, hostLocal, broadcasterPC]);

  return { connected, remote, mixed };
}
