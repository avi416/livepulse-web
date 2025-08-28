import { 
  collection, 
  addDoc, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  serverTimestamp, 
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { getFirestoreInstance } from './firebase';
import { LIVE_OWNER_FIELD } from '../constants/firestore';
import { getAuth } from 'firebase/auth';

export type LiveStreamStatus = 'live' | 'ended';

export interface Stream {
  id: string;
  title: string;
  description?: string;
  createdAt: number;
  isLive: boolean;
  userId: string | null;
}

export interface LiveStreamDoc {
  id: string;
  title: string;
  status: LiveStreamStatus;
  startedAt: unknown;
  endedAt?: unknown;
  lastSeen?: unknown;
  userId: string | null; // canonical owner field
  uid?: string | null;   // legacy, optional for backwards compat
  displayName?: string | null;
  photoURL?: string | null;
  participants?: string[];
}

/**
 * 📺 יצירת שידור חי חדש בפיירסטור
 */
export async function startLiveStream(title: string): Promise<string> {
  const db = getFirestoreInstance();
  const liveId = `stream_${Date.now()}`;
  const ref = doc(db, 'liveStreams', liveId);

  // נביא את המשתמש הנוכחי מ־Auth
  const auth = getAuth();
  const user = auth.currentUser;

  // End any previous live sessions for this user (cleanup duplicates)
  if (user?.uid) {
    try {
      const q1 = query(collection(db, 'liveStreams'), where('status', '==', 'live'), where('uid', '==', user.uid));
      const q2 = query(collection(db, 'liveStreams'), where('status', '==', 'live'), where('userId', '==', user.uid));
      const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      const toEnd = new Map<string, any>();
      s1.forEach((d: any) => toEnd.set(d.id, d));
      s2.forEach((d: any) => toEnd.set(d.id, d));
      await Promise.all(Array.from(toEnd.values()).map(async (d: any) => {
        try { await updateDoc(doc(db, 'liveStreams', d.id), { status: 'ended', endedAt: serverTimestamp() }); } catch {}
      }));
    } catch (e) {
      console.warn('⚠️ Failed to end previous lives for user:', e);
    }
  }

  // Write primary live doc
  await setDoc(ref, {
    id: liveId,
    title,
    status: 'live',
    startedAt: serverTimestamp(),
  lastSeen: serverTimestamp(),
  // write both for backward compat, but treat userId as canonical everywhere
  uid: user ? user.uid : null,
  [LIVE_OWNER_FIELD]: user ? user.uid : null,
    displayName: user?.displayName || 'Anonymous',
    photoURL: user?.photoURL || null,
  });

  // Mirror into legacy directory collection 'streams' with same id for discovery
  await setDoc(doc(db, 'streams', liveId), {
    id: liveId,
    title,
    isLive: true,
    startedAt: serverTimestamp(),
    lastSeen: serverTimestamp(),
    userId: user ? user.uid : null,
    uid: user ? user.uid : null,
    displayName: user?.displayName || 'Anonymous',
    photoURL: user?.photoURL || null,
  }, { merge: true });

  return liveId;
}

/**
 * 🛑 סיום שידור חי
 */
export async function endLiveStream(id: string): Promise<void> {
  const db = getFirestoreInstance();
  await updateDoc(doc(db, 'liveStreams', id), {
    status: 'ended',
    endedAt: serverTimestamp(),
  });
  // Mirror end to 'streams'
  try {
    await updateDoc(doc(db, 'streams', id), {
      isLive: false,
      endedAt: serverTimestamp(),
    });
  } catch {}
}

/**
 * 📡 החזרת כל השידורים החיים
 */
export async function getLiveStreams(): Promise<LiveStreamDoc[]> {
  const db = getFirestoreInstance();
  const snap = await getDocs(collection(db, 'liveStreams'));
  return snap.docs.map((d: any) => d.data() as LiveStreamDoc);
}

/**
 * 🎯 Fetch only currently live streams (status == 'live'), newest first
 */
export async function getLiveOnlyStreams(): Promise<LiveStreamDoc[]> {
  const db = getFirestoreInstance();
  const q = query(
    collection(db, 'liveStreams'),
    where('status', '==', 'live'),
    orderBy('startedAt', 'desc')
  );
  const snap = await getDocs(q);
  const items = snap.docs.map((d: any) => d.data() as LiveStreamDoc);
  // Client-side freshness filter using lastSeen (<= 45s old)
  const now = Date.now();
  const fresh = items.filter((it: any) => {
    const ts: any = it.lastSeen || it.startedAt;
    try {
      const ms = typeof ts?.toMillis === 'function' ? ts.toMillis() : (typeof ts === 'number' ? ts : 0);
      return ms && now - ms <= 45_000;
    } catch {
      return false;
    }
  });
  return fresh as LiveStreamDoc[];
}

/**
 * 🔄 Heartbeat: update lastSeen to keep stream considered "live".
 */
export async function heartbeatLiveStream(id: string): Promise<void> {
  const db = getFirestoreInstance();
  await updateDoc(doc(db, 'liveStreams', id), { lastSeen: serverTimestamp(), status: 'live' });
  // Keep legacy directory doc fresh too
  try {
    await updateDoc(doc(db, 'streams', id), {
      lastSeen: serverTimestamp(),
      isLive: true,
    });
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Co-host requests API
// ─────────────────────────────────────────────────────────────────────────────
export type JoinRequestStatus = 'pending' | 'approved' | 'rejected';
export interface JoinRequestDoc {
  userId: string;
  status: JoinRequestStatus;
  createdAt: unknown; // Timestamp
  approvedAt?: unknown;
  rejectedAt?: unknown;
  displayName?: string | null;
  photoURL?: string | null;
}

export async function requestToJoin(liveId: string, userId: string): Promise<void> {
  const db = getFirestoreInstance();
  const auth = getAuth();
  const u = auth.currentUser;
  await setDoc(doc(db, 'liveStreams', liveId, 'requests', userId), {
    userId,
    status: 'pending',
    createdAt: serverTimestamp(),
    displayName: u?.displayName ?? null,
    photoURL: u?.photoURL ?? null,
  } as JoinRequestDoc);
}

export function subscribeToRequests(liveId: string, cb: (items: (JoinRequestDoc & { id: string })[]) => void): () => void {
  const db = getFirestoreInstance();
  const q = query(collection(db, 'liveStreams', liveId, 'requests'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap: any) => {
    const items = (snap.docs as any[]).map((d: any) => ({ id: d.id, ...(d.data() as JoinRequestDoc) }));
    cb(items);
  });
}

export function subscribeToMyRequest(
  liveId: string,
  userId: string,
  cb: (req: (JoinRequestDoc & { id: string }) | null) => void
): () => void {
  const db = getFirestoreInstance();
  const ref = doc(db, 'liveStreams', liveId, 'requests', userId);
  return onSnapshot(ref, (snap: any) => {
    if (!snap.exists()) { cb(null); return; }
    const data = snap.data() as JoinRequestDoc;
    cb({ id: snap.id, ...data });
  });
}

export async function approveJoinRequest(liveId: string, userId: string): Promise<void> {
  const db = getFirestoreInstance();
  await updateDoc(doc(db, 'liveStreams', liveId, 'requests', userId), {
    status: 'approved',
    approvedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'liveStreams', liveId), { participants: arrayUnion(userId) });
}

export async function rejectJoinRequest(liveId: string, userId: string): Promise<void> {
  const db = getFirestoreInstance();
  await updateDoc(doc(db, 'liveStreams', liveId, 'requests', userId), {
    status: 'rejected',
    rejectedAt: serverTimestamp(),
  });
}

export async function removeParticipant(liveId: string, userId: string): Promise<void> {
  const db = getFirestoreInstance();
  await updateDoc(doc(db, 'liveStreams', liveId), { participants: arrayRemove(userId) });
}

/**
 * 📝 יצירת מטא-דאטה לשידור (במידה ורוצים גם טבלת streams כללית)
 */
export async function createStreamMetadata(stream: Omit<Stream, 'id'>) {
  const db = getFirestoreInstance();
  // Prefer explicit ID sync with liveStreams: this helper remains for compatibility
  // Callers should mirror using the same id as liveStreams; here we keep the old path for safety
  const col = collection(db, 'streams');
  const ref = await addDoc(col, stream as any);
  await setDoc(doc(db, 'streams', ref.id), { ...stream, id: ref.id });
  return ref.id;
}

/**
 * 🎯 החזרת שידור לפי מזהה
 */
export async function getStreamById(id: string) {
  const db = getFirestoreInstance();
  const docRef = doc(db, 'liveStreams', id);
  const snap = await getDoc(docRef);
  return snap.exists() ? (snap.data() as LiveStreamDoc) : null;
}
