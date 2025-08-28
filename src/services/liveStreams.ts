import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { LIVE_OWNER_FIELD } from '../constants/firestore';
import { getAuthInstance, getFirestoreInstance } from './firebase';

export type LiveStreamStatus = 'live' | 'ended';

export interface LiveStreamDoc {
  id: string;
  uid: string;
  userId?: string; // canonical owner field (present on new docs)
  displayName: string;
  photoURL: string | null;
  title: string;
  status: LiveStreamStatus;
  startedAt: unknown; // Firestore Timestamp
  endedAt?: unknown;  // Firestore Timestamp
  lastSeen?: unknown; // Firestore Timestamp
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
  [LIVE_OWNER_FIELD]: user.uid,
    displayName: user.displayName || user.email || 'User',
    photoURL: user.photoURL || null,
    title,
    status: 'live',
    startedAt: serverTimestamp(),
  } as Omit<LiveStreamDoc, 'startedAt' | 'endedAt'> & { startedAt: unknown });

  return liveId;
}

export async function endLiveStream(id: string): Promise<void> {
  const db = getFirestoreInstance();
  await updateDoc(doc(db, 'liveStreams', id), {
    status: 'ended',
    endedAt: serverTimestamp(),
  });
}

export function subscribeToLiveStreams(onChange: (items: LiveStreamDoc[]) => void): () => void {
  const db = getFirestoreInstance();

  // Avoid time-based server-side filters (mobile clock skew can hide lives)
  const qStatus = query(
    collection(db, 'liveStreams'),
    where('status', '==', 'live'),
    orderBy('startedAt', 'desc')
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

  const mapAndDedupe = (docs: any[]): LiveStreamDoc[] => {
    const items = (docs as any[]).map((d: any) => d.data() as LiveStreamDoc);
    return dedupeByUid(items);
  };

  // Primary: server-side freshness filtering (may require a composite index)
  let unsub: () => void = () => {};
  unsub = onSnapshot(qStatus, (snap: any) => {
    onChange(mapAndDedupe(snap.docs as any[]));
  }, (err: any) => {
    console.warn('[live] orderBy index missing or query failed, falling back:', err?.message || err);
    try { unsub(); } catch {}
    const qStatusOnly = query(collection(db, 'liveStreams'), where('status', '==', 'live'));
    unsub = onSnapshot(qStatusOnly, (snap2: any) => {
      // client-side sort by startedAt desc if available
      const items = (snap2.docs as any[]).map((d: any) => d.data() as LiveStreamDoc);
      const sorted = items.sort((a, b) => {
        const toMs = (ts: any) => {
          try { return typeof ts?.toMillis === 'function' ? ts.toMillis() : (typeof ts === 'number' ? ts : 0); } catch { return 0; }
          };
        return toMs((b as any).startedAt) - toMs((a as any).startedAt);
      });
      onChange(dedupeByUid(sorted));
    });
  });

  return () => { try { unsub(); } catch {} };
} 