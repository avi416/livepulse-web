import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { getAuthInstance, getFirestoreInstance, googleProvider } from '../services/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function Login() {
  const auth = getAuthInstance();
  const db = getFirestoreInstance();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/profile/me');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setLoading(true);
    try {
      const res = await signInWithPopup(auth, googleProvider);
      const user = res.user;
      // ensure user doc exists
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name: user.displayName ?? (user.email ? user.email.split('@')[0] : ''),
        email: user.email,
        role: 'user',
        createdAt: serverTimestamp(),
      }, { merge: true });
      navigate('/profile/me');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <div className="w-full max-w-md p-6 rounded-lg bg-[var(--panel)] shadow-md">
        <h2 className="text-2xl font-semibold mb-4 text-white">Sign in</h2>
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md px-3 py-2 bg-transparent border border-slate-700 text-white placeholder:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)]"
            required
          />
          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md px-3 py-2 bg-transparent border border-slate-700 text-white placeholder:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)]"
            required
          />
          {error && <div className="text-red-400 text-sm">{error}</div>}
          <button type="submit" disabled={loading} className="w-full bg-[color:var(--primary)] text-black font-semibold py-2 rounded-md">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="my-3 border-t border-white/10" />

        <button onClick={handleGoogle} className="w-full flex items-center justify-center gap-2 border border-white/10 rounded-md py-2 text-white">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21.35 11.1H12v2.8h5.35c-.23 1.34-1.01 2.49-2.16 3.27v2.7h3.49C20.66 19.1 22 15.4 22 12c0-.67-.07-1.32-.2-1.9z" fill="#4285F4"/><path d="M12 22c2.7 0 4.97-.9 6.63-2.43l-3.49-2.7c-.97.66-2.21 1.06-3.14 1.06-2.41 0-4.45-1.63-5.18-3.82H3.14v2.4C4.8 19.8 8.12 22 12 22z" fill="#34A853"/><path d="M6.82 13.11A6.99 6.99 0 016 12c0-.66.11-1.3.32-1.9V7.7H3.14A9.99 9.99 0 002 12c0 1.6.36 3.12 1.02 4.44l3.8-3.33z" fill="#FBBC05"/><path d="M12 6.5c1.47 0 2.8.5 3.85 1.47l2.88-2.88C16.96 3.73 14.7 3 12 3 8.12 3 4.8 5.2 3.14 8.3l3.18 2.2C7.55 8.13 9.59 6.5 12 6.5z" fill="#EA4335"/></svg>
          Sign in with Google
        </button>

        <p className="text-sm text-white/80 mt-3">Don't have an account? <Link to="/signup" className="text-[color:var(--primary)]">Sign up</Link></p>
      </div>
    </div>
  );
}
