import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuthUser from '../hooks/useAuthUser';

export default function LiveHub() {
  const { user, loading } = useAuthUser();
  const nav = useNavigate();

  function handleGoLive() {
    if (!user) {
      nav('/login');
      return;
    }
    nav('/live/go');
  }

  return (
    <div className="pt-12 max-w-3xl mx-auto p-4">
      <h2 className="text-2xl font-semibold">Live</h2>
      <p className="mt-2 text-[var(--muted)]">Watch broadcasts or start your own live stream.</p>

      <div className="mt-6 flex gap-3">
        <Link to="/live/watch" className="px-4 py-2 rounded bg-[var(--panel)] text-white">Watch Live</Link>
        <button
          onClick={handleGoLive}
          disabled={loading}
          className="px-4 py-2 rounded bg-[var(--primary)] text-white disabled:opacity-60"
        >
          Go Live
        </button>
      </div>
    </div>
  );
}
