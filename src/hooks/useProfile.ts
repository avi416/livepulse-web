import { useEffect, useState } from 'react';
import type { User } from '../types/user';
import { getAuthInstance, getFirestoreInstance } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

type UseProfileResult = {
  user: User | null;
  loading: boolean;
  error: string | null;
};

/**
 * Fetch a profile by uid or resolve 'me' to current auth user.
 * Returns { user, loading, error }.
 */
export function useProfile(handleOrUid?: string): UseProfileResult {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubAuth: (() => void) | undefined;
    let cancelled = false;

    async function fetchByUid(uid: string) {
      try {
        const db = getFirestoreInstance();
        const ref = doc(db, 'users', uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setError('not-found');
          setUser(null);
        } else {
          const d = snap.data() as any;
          const out: User = {
            uid: d.uid,
            handle: d.uid,
            name: d.name || d.displayName || '',
            avatarUrl: d.avatarUrl,
            role: d.role || 'user',
          };
          setUser(out);
        }
      } catch (e: any) {
        setError(e?.message ?? String(e));
        setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    setLoading(true);
    setError(null);
    setUser(null);

    if (!handleOrUid) {
      setError('missing-handle');
      setLoading(false);
      return () => {};
    }

    if (handleOrUid === 'me') {
      // wait for auth state
      const auth = getAuthInstance();
      type LocalAuthUser = { uid: string };
      unsubAuth = onAuthStateChanged(auth, (current: unknown) => {
        const u = current as LocalAuthUser | null;
        if (u && typeof u.uid === 'string') {
          fetchByUid(u.uid);
        } else {
          setLoading(false);
          setError('not-authenticated');
        }
      });
    } else {
      // treat as uid
      fetchByUid(handleOrUid);
    }

    return () => {
      cancelled = true;
      if (unsubAuth) unsubAuth();
    };
  }, [handleOrUid]);

  return { user, loading, error };
}
