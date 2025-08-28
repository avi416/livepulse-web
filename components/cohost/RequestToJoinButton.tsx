import { useEffect, useRef, useState } from 'react';
import { requestToJoin, subscribeToMyRequest } from '../../services/streamService';
import useAuthUser from '../../hooks/useAuthUser';
import CoHostJoiner from './CoHostJoiner';
import type { CoHostJoinerHandle } from './CoHostJoiner';
import LeaveLiveButton from './LeaveLiveButton';
import '../../styles/cohost.css';

export default function RequestToJoinButton({ liveId }: { liveId: string }) {
  const { user } = useAuthUser();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'pending' | 'approved' | 'rejected'>('idle');
  const joinerRef = useRef<CoHostJoinerHandle | null>(null);

  const handle = async () => {
    setError(null);
    if (!user) { setError('Please sign in'); return; }
    try {
      await requestToJoin(liveId, user.uid);
      setSent(true);
      setStatus('pending');
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  useEffect(() => {
    if (!user || !sent) return;
    const unsub = subscribeToMyRequest(liveId, user.uid, (req) => {
      if (!req) return;
      setStatus(req.status as any);
    });
    return () => { try { unsub?.(); } catch {} };
  }, [liveId, user, sent]);

  return (
    <div>
      {status !== 'approved' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={handle} disabled={sent && status !== 'rejected'} className="cohost-btn cohost-btn-join">
            {status === 'pending' ? 'Requested…' : status === 'rejected' ? 'Request Rejected' : 'Request to Join'}
          </button>
          {error && <span style={{ color: '#f87171', fontSize: 12 }}>{error}</span>}
        </div>
      )}
      {status === 'approved' && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <CoHostJoiner ref={joinerRef as any} liveId={liveId} />
          <LeaveLiveButton liveId={liveId} onCleanup={() => joinerRef.current?.cleanup()} />
        </div>
      )}
    </div>
  );
}
