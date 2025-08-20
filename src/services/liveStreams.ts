import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { getAuthInstance, getFirestoreInstance } from './firebase';

export type LiveStreamStatus = 'live' | 'ended';

export interface LiveStreamDoc {
  id: string;
  uid: string;
  displayName: string;
  photoURL: string | null;
  title: string;
  status: LiveStreamStatus;
  startedAt: unknown; // Firestore Timestamp
  endedAt?: unknown;  // Firestore Timestamp
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
  const db = getFirestoreInstance();
  await updateDoc(doc(db, 'liveStreams', id), {
    status: 'ended',
    endedAt: serverTimestamp(),
  });
}

export function subscribeToLiveStreams(onChange: (items: LiveStreamDoc[]) => void): () => void {
  const db = getFirestoreInstance();
  const q = query(collection(db, 'liveStreams'), where('status', '==', 'live'));
  return onSnapshot(q, (snap: any) => {
    const items = (snap.docs as any[]).map((d: any) => d.data() as LiveStreamDoc);
    onChange(items);
  });
} 