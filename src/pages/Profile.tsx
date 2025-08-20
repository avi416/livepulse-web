import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProfile } from '../hooks/useProfile';

export default function Profile() {
  const { handle } = useParams();
  const navigate = useNavigate();
  const key = handle || 'me';
  const { user, loading, error } = useProfile(key);

  useEffect(() => {
    if (error === 'not-authenticated') navigate('/login');
  }, [error, navigate]);

  if (loading) return <div className="pt-12 p-4 text-center">Loading profile...</div>;
  if (error) return <div className="pt-12 p-4 text-center text-red-400">Error: {error}</div>;
  if (!user) return <div className="pt-12 p-4 text-center">Profile not found</div>;

  let created: Date | undefined;
  const createdRaw = (user as unknown as { createdAt?: number | { seconds?: number } | undefined }).createdAt;
  if (typeof createdRaw === 'number') created = new Date(createdRaw);
  else if (createdRaw && typeof createdRaw === 'object' && 'seconds' in createdRaw && typeof (createdRaw as any).seconds === 'number') {
    created = new Date((createdRaw as any).seconds * 1000);
  } else created = undefined;

  return (
    <div className="pt-12 min-h-screen flex items-start justify-center">
      <div className="mt-8 w-full max-w-lg bg-gray-900 text-white rounded-lg p-6 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-blue-300 rounded-full flex items-center justify-center text-xl font-bold text-white">{user.name?.charAt(0) ?? '?'}</div>
          <div>
            <div className="text-2xl font-semibold">{user.name}</div>
            <div className="text-sm text-gray-300">{(user as unknown as { email?: string }).email}</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 text-sm text-gray-300">
          <div className="p-3 bg-gray-800 rounded">Role: <span className="font-medium text-white">{user.role}</span></div>
          <div className="p-3 bg-gray-800 rounded">Joined: <span className="font-medium text-white">{created ? created.toLocaleDateString() : '—'}</span></div>
        </div>
      </div>
    </div>
  );
}
