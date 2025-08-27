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
  orderBy
} from 'firebase/firestore';
import { getFirestoreInstance } from './firebase';
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
  uid?: string | null;
  userId?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
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

  await setDoc(ref, {
    id: liveId,
    title,
    status: 'live',
    startedAt: serverTimestamp(),
  lastSeen: serverTimestamp(),
    uid: user ? user.uid : null,
    userId: user ? user.uid : null,
    displayName: user?.displayName || 'Anonymous',
    photoURL: user?.photoURL || null,
  });

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
  await updateDoc(doc(db, 'liveStreams', id), { lastSeen: serverTimestamp() });
}

/**
 * 📝 יצירת מטא-דאטה לשידור (במידה ורוצים גם טבלת streams כללית)
 */
export async function createStreamMetadata(stream: Omit<Stream, 'id'>) {
  const db = getFirestoreInstance();
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
