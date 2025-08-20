import type { Stream } from '../types/stream';
import { collection, addDoc, doc, setDoc, getDoc, getDocs } from 'firebase/firestore';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { getFirestoreInstance } from './firebase';

// Return all streams (firestore-backed). In production you might add queries for only live streams.
export async function getLiveStreams(): Promise<Stream[]> {
  const db = getFirestoreInstance();
  const snap = await getDocs(collection(db, 'streams'));
  // Firestore returns document snapshots; treat docs as unknown and pull their data safely
  const docs = snap.docs as unknown as Array<{ data: () => unknown }>;
  return docs.map((d) => d.data() as Stream);
}

// create stream metadata and return generated id
export async function createStreamMetadata(stream: Omit<Stream, 'id'>) {
  const db = getFirestoreInstance();
  const col = collection(db, 'streams');
  const ref = await addDoc(col, stream as unknown as any);
  await setDoc(doc(db, 'streams', ref.id), { ...stream, id: ref.id });
  return ref.id;
}

export async function getStreamById(id: string) {
  const db = getFirestoreInstance();
  const docRef = doc(db, 'streams', id);
  const snap = await getDoc(docRef);
  return snap.exists() ? (snap.data() as Stream) : null;
}
