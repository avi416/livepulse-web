import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, Timestamp, where } from 'firebase/firestore';
import { getAuthInstance, getFirestoreInstance } from './firebase';
import { safeUpdateLiveStream } from './streamService';

export type LiveStreamStatus = 'live' | 'ended';

export interface LiveStreamDoc {
  id: string;
  uid?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  title: string;
  status: LiveStreamStatus;
  startedAt: unknown; // Firestore Timestamp
  endedAt?: unknown;  // Firestore Timestamp
  lastSeen?: unknown; // Firestore Timestamp
  // Additional properties for TypeScript compilation
  cohosts?: Record<string, any>;
  hostName?: string;
  description?: string;
  viewerCount?: number;
  hasCoHost?: boolean;
  errorRecovery?: boolean;
  reconnectedAt?: string;
}

export async function startLiveStream(title: string): Promise<string> {
  const auth = getAuthInstance();
  const db = getFirestoreInstance();
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');

  const liveId = `${user.uid}_${Date.now()}`;
  const ref = doc(db, 'liveStreams', liveId);

  await setDoc(ref, {
    id: liveId,
    uid: user.uid,
    displayName: user.displayName || user.email || 'User',
    photoURL: user.photoURL || null,
    title,
    status: 'live',
    startedAt: serverTimestamp(),
  } as Omit<LiveStreamDoc, 'startedAt' | 'endedAt'> & { startedAt: unknown });

  return liveId;
}

export async function endLiveStream(id: string): Promise<void> {
  await safeUpdateLiveStream(id, {
    status: 'ended',
    endedAt: serverTimestamp(),
  }, { allowEnd: true });
}

export function subscribeToLiveStreams(onChange: (items: LiveStreamDoc[]) => void): () => void {
  const db = getFirestoreInstance();

  const freshnessMs = 45_000; // consider live only if seen within last 45s
  const threshold = Timestamp.fromMillis(Date.now() - freshnessMs);

  const qFresh = query(
    collection(db, 'liveStreams'),
    where('status', '==', 'live'),
    where('lastSeen', '>=', threshold),
    orderBy('lastSeen', 'desc')
  );

  const sortKey = (it: any) => {
    const ts: any = it.lastSeen || it.startedAt;
    try { return typeof ts?.toMillis === 'function' ? ts.toMillis() : (typeof ts === 'number' ? ts : 0); } catch { return 0; }
  };

  const dedupeByUid = (items: LiveStreamDoc[]): LiveStreamDoc[] => {
    const byUid = new Map<string, LiveStreamDoc>();
    for (const it of items) {
      const key = (it as any).uid || 'unknown';
      const prev = byUid.get(key);
      if (!prev) { byUid.set(key, it); continue; }
      if (sortKey(it) > sortKey(prev)) byUid.set(key, it);
    }
    return Array.from(byUid.values()).sort((a, b) => sortKey(b) - sortKey(a));
  };

  const clientFilter = (docs: any[]): LiveStreamDoc[] => {
    const now = Date.now();
    const filtered = docs
      .map((d: any) => d.data() as LiveStreamDoc)
      .filter((it: any) => {
        const ts: any = it.lastSeen || it.startedAt;
        try {
          const ms = typeof ts?.toMillis === 'function' ? ts.toMillis() : (typeof ts === 'number' ? ts : 0);
          return ms && (now - ms) <= freshnessMs;
        } catch {
          return false;
        }
      }) as any;
    return dedupeByUid(filtered);
  };

  // Primary: server-side freshness filtering (may require a composite index)
  let unsub: () => void = () => {};
  unsub = onSnapshot(qFresh, (snap: any) => {
    const items = (snap.docs as any[]).map((d: any) => d.data() as LiveStreamDoc);
    onChange(dedupeByUid(items));
  }, (err: any) => {
    console.warn('[live] Falling back to client-side freshness filter:', err?.message || err);
    try { unsub(); } catch {}
    const qStatus = query(collection(db, 'liveStreams'), where('status', '==', 'live'));
    unsub = onSnapshot(qStatus, (snap: any) => {
      onChange(clientFilter(snap.docs as any[]));
    });
  });

  return () => { try { unsub(); } catch {} };
} 