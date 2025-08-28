import { useCallback, useEffect, useRef, useState } from 'react';
import '../../styles/cohost.css';
import { removeParticipant } from '../../services/streamService';
import useAuthUser from '../../hooks/useAuthUser';

type Props = {
  liveId: string;
  onCleanup?: () => void; // close peer connections, stop local tracks
};

export default function LeaveLiveButton({ liveId, onCleanup }: Props) {
  const { user } = useAuthUser();
  const [leaving, setLeaving] = useState(false);
  const leftRef = useRef(false);

  const leave = useCallback(async () => {
    if (leftRef.current) return;
    setLeaving(true);
    try {
      onCleanup?.();
      if (user?.uid) await removeParticipant(liveId, user.uid);
    } catch {}
    finally { leftRef.current = true; setLeaving(false); }
  }, [liveId, onCleanup, user?.uid]);

  useEffect(() => {
    return () => { try { onCleanup?.(); } catch {} };
  }, [onCleanup]);

  return (
    <button className="cohost-btn cohost-btn-stop" onClick={leave} disabled={leaving}>
      {leaving ? 'Leaving…' : 'Leave Live'}
    </button>
  );
}
