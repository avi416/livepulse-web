import { useState } from 'react';
import { getAuthInstance, getFirestoreInstance, googleProvider } from '../services/firebase';
import { createUserWithEmailAndPassword, signInWithPopup, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

export function useRegister() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function registerWithEmail(email: string, password: string, displayName?: string) {
    setLoading(true);
    setError(null);
    try {
      const auth = getAuthInstance();
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) await updateProfile(userCred.user, { displayName });
      await createUserDoc(userCred.user.uid, userCred.user.email || email, displayName || userCred.user.displayName || '');
      return userCred.user;
    } catch (e: any) {
      setError(e.message || String(e));
      throw e;
    } finally {
      setLoading(false);
    }
  }

  async function registerWithGoogle() {
    setLoading(true);
    setError(null);
    try {
      const auth = getAuthInstance();
      const result = await signInWithPopup(auth, googleProvider);
      const u = result.user;
      await createUserDoc(u.uid, u.email || '', u.displayName || '');
      return u;
    } catch (e: any) {
      setError(e.message || String(e));
      throw e;
    } finally {
      setLoading(false);
    }
  }

  async function createUserDoc(uid: string, email: string, name: string) {
    const db = getFirestoreInstance();
    const ref = doc(db, 'users', uid);
    await setDoc(ref, { uid, email, name, role: 'user', createdAt: Date.now() }, { merge: true });
  }

  return { loading, error, registerWithEmail, registerWithGoogle };
}
