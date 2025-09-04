import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProfile } from '../hooks/useProfile';
import '../styles/pages/Profile.css';
import UserAvatar from '../components/UserAvatar';

export default function Profile() {
  const { handle } = useParams();
  const navigate = useNavigate();
  const key = handle || 'me';
  const { user, loading, error } = useProfile(key);

  useEffect(() => {
    if (error === 'not-authenticated') navigate('/login');
  }, [error, navigate]);

  if (loading) return <div className="profile profile--loading">Loading profile...</div>;
  if (error) return <div className="profile profile--error">Error: {error}</div>;
  if (!user) return <div className="profile profile--not-found">Profile not found</div>;

  let created: Date | undefined;
  const createdRaw = (user as unknown as { createdAt?: number | { seconds?: number } | undefined }).createdAt;
  if (typeof createdRaw === 'number') created = new Date(createdRaw);
  else if (createdRaw && typeof createdRaw === 'object' && 'seconds' in createdRaw && typeof (createdRaw as any).seconds === 'number') {
    created = new Date((createdRaw as any).seconds * 1000);
  } else created = undefined;

  return (
    <div className="profile">
      <div className="profile__card">
        <div className="profile__header">
          <div className="profile__avatar">
            {(user as any).photoURL ? (
              <UserAvatar
                photoURL={(user as any).photoURL}
                displayName={user.name}
                email={(user as any).email}
                size={80}
              />
            ) : (
              <div className="avatar avatar--lg">{user.name?.charAt(0) ?? '?'}</div>
            )}
          </div>
          <div className="profile__info">
            <h1 className="profile__name">{user.name}</h1>
            <div className="profile__email">{(user as unknown as { email?: string }).email}</div>
          </div>
        </div>

        <div className="profile__details">
          <div className="profile__detail">
            <span className="profile__detail-label">Role</span>
            <span className="profile__detail-value">{user.role}</span>
          </div>
          <div className="profile__detail">
            <span className="profile__detail-label">Joined</span>
            <span className="profile__detail-value">{created ? created.toLocaleDateString() : '—'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
