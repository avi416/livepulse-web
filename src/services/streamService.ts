import { 
  collection, 
  addDoc, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  serverTimestamp, 
  updateDoc 
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

  await setDoc(ref, {
    id: liveId,
    title,
    status: 'live',
    startedAt: serverTimestamp(),
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
  return snap.docs.map((d) => d.data() as LiveStreamDoc);
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
