/**
 * One-off script to backfill userId from uid for legacy liveStreams docs.
 * Usage: run with ts-node after initializing Firebase Admin/Client as appropriate.
 * Not wired to the app build.
 */
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { getFirestoreInstance } from '../src/services/firebase';

async function run() {
  const db = getFirestoreInstance();
  const snap = await getDocs(collection(db, 'liveStreams'));
  let updated = 0;
  for (const d of snap.docs as any[]) {
    const data = d.data() as any;
    if (!data.userId && data.uid) {
      await updateDoc(doc(db, 'liveStreams', d.id), { userId: data.uid });
      updated++;
    }
  }
  // eslint-disable-next-line no-console
  console.log(`Backfill complete. Updated ${updated} documents.`);
}

run().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('Backfill failed:', e);
  process.exit(1);
});
