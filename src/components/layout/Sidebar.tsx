import { NavLink } from 'react-router-dom';
import { Search, Home, Compass, Users, PlusSquare, Tv, User, MoreHorizontal, LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getAuthInstance } from '../../services/firebase';
import UserAvatar from '../UserAvatar';
import '../../styles/components/Sidebar.css';

const menu = [
  { to: '/', label: 'For You', icon: Home },
  { to: '/explore', label: 'Explore', icon: Compass },
  { to: '/following', label: 'Following', icon: Users },
  { to: '/upload', label: 'Upload', icon: PlusSquare },
  { to: '/live', label: 'LIVE', icon: Tv },
  { to: '/profile/me', label: 'Profile', icon: User },
  { to: '/more', label: 'More', icon: MoreHorizontal },
];

export default function Sidebar() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      const auth = getAuthInstance();
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <aside className="sidebar px-3">
      <div className="mb-4">
        <div className="flex items-center gap-2 px-2 py-2 rounded-md bg-[var(--panel)] shadow-sm">
          <Search className="w-5 h-5 text-[var(--muted)]" />
          <input
            placeholder="Search"
            aria-label="Search"
            className="bg-transparent outline-none w-full text-sm text-[var(--muted)]"
          />
        </div>
      </div>

      <nav className="nav">
        {menu.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to}>
              {({ isActive }) => (
                <div
                  className={`relative flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--panel)]/60 transition-colors ${
                    isActive ? 'font-semibold text-[var(--primary)] bg-[var(--primary)]/10' : 'text-[var(--muted)]'
                  }`}
                >
                  <span className="flex items-center justify-center w-8 h-8">
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className="truncate">{item.label}</span>
                  {isActive && <span className="absolute left-0 top-0 h-full w-1 rounded-r bg-[var(--primary)]" />}
                </div>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-6">
        {loading ? (
          <div className="w-full px-4 py-2 rounded-md bg-gray-200 animate-pulse h-10"></div>
        ) : user ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-[var(--panel)]">
              <UserAvatar
                photoURL={user.photoURL}
                displayName={user.displayName}
                email={user.email}
                size={32}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">
                  {user.displayName || user.email?.split('@')[0] || 'User'}
                </div>
                <div className="text-xs text-[var(--muted)] truncate">
                  {user.email}
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        ) : (
          <NavLink to="/login">
            <button className="w-full px-4 py-2 rounded-md bg-[var(--primary)] text-white font-medium hover:bg-[var(--primary)]/90 transition-colors">
              Log in
            </button>
          </NavLink>
        )}
      </div>
    </aside>
  );
}
