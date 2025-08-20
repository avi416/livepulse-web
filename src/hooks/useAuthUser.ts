import { useEffect, useState } from 'react';
import type { Unsubscribe } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { getAuthInstance } from '../services/firebase';

export type AuthUser = {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
};

export default function useAuthUser() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuthInstance();
    const unsub: Unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser({
          uid: u.uid,
          displayName: u.displayName ?? null,
          email: u.email ?? null,
          photoURL: u.photoURL ?? null,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return { user, loading } as const;
}
