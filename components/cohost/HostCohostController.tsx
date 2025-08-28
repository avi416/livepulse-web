import { useEffect, useMemo, useState } from 'react';
import { subscribeToRequests, type JoinRequestDoc } from '../../services/streamService';
import '../../styles/cohost.css';

export default function HostCohostController({ liveId }: { liveId: string; }) {
  const [items, setItems] = useState<(JoinRequestDoc & { id: string })[]>([]);
  useEffect(() => {
    const unsub = subscribeToRequests(liveId, setItems);
    return () => unsub();
  }, [liveId]);

  const firstApproved = useMemo(() => items.find(i => i.status === 'approved')?.id || '', [items]);

  return (
    <div className="cohost-panel">
      <div className="cohost-panel-title">Co-host status</div>
      <div className="cohost-req-meta">{firstApproved ? `Approved: ${firstApproved}` : 'No approved co-host yet'}</div>
    </div>
  );
}
