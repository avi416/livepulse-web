import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { getFirestoreInstance } from '../services/firebase';

export interface LegacyStreamDoc {
  id: string;
  title: string;
  isLive: boolean;
  lastSeen?: unknown;
  displayName?: string | null;
  photoURL?: string | null;
  userId?: string | null;
}

export function useLegacyStreamsDirectory() {
  const [items, setItems] = useState<LegacyStreamDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const db = getFirestoreInstance();
    setLoading(true);
    setError(null);
    const q = query(
      collection(db, 'streams'),
      where('isLive', '==', true),
      orderBy('lastSeen', 'desc')
    );
    const unsub = onSnapshot(q, (snap: any) => {
      const list = (snap.docs as any[]).map((d: any) => d.data() as LegacyStreamDoc);
      setItems(list);
      setLoading(false);
    }, (err: any) => {
      setError(err?.message || String(err));
      setLoading(false);
    });
    return () => { try { unsub(); } catch {} };
  }, []);

  return { items, loading, error };
}
