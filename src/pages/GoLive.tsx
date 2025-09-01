import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthUser from '../hooks/useAuthUser';
import LiveStreamComponent from '../components/LiveStream';

export default function GoLive() {
  const { user, loading } = useAuthUser();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && !user) nav('/login');
  }, [loading, user, nav]);

  if (loading) return <div className="pt-12 max-w-3xl mx-auto p-4">Checking auth...</div>;
  if (!user) return null;

  // משתמש מחובר – מציגים את דף הלייב
  return <LiveStreamComponent />;
}
