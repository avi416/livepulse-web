import { useEffect, useState } from 'react';
import { approveJoinRequest, rejectJoinRequest, subscribeToRequests, type JoinRequestDoc } from '../../services/streamService';
import '../../styles/cohost.css';

type Row = (JoinRequestDoc & { id: string });

export default function RequestsPanel({ liveId }: { liveId: string }) {
  const [items, setItems] = useState<Row[]>([]);

  useEffect(() => {
    const unsub = subscribeToRequests(liveId, setItems);
    return () => unsub();
  }, [liveId]);

  const pending = items.filter(i => i.status === 'pending');

  return (
    <div className="requests-panel">
      <div className="cohost-panel-title">Join requests</div>
      {pending.length === 0 && <div className="cohost-req-meta">No pending requests</div>}
      <div>
        {pending.map((r) => (
          <div key={r.id} className="cohost-req-row">
            {r.photoURL ? (
              <img src={r.photoURL} alt={r.displayName || r.id} className="cohost-avatar" />
            ) : (
              <div className="cohost-avatar">{(r.displayName || r.id || 'U')[0].toUpperCase()}</div>
            )}
            <div>
              <div style={{ fontWeight: 600 }}>{r.displayName || r.id}</div>
              <div className="cohost-req-meta">wants to join your live</div>
            </div>
            <div className="cohost-req-actions">
              <button className="btn-approve" onClick={() => approveJoinRequest(liveId, r.id)}>Approve</button>
              <button className="btn-reject" onClick={() => rejectJoinRequest(liveId, r.id)}>Reject</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
