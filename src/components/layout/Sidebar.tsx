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
    <aside className="sidebar">
      <div className="sidebar__search">
        <div className="search search--sidebar">
          <Search className="search__icon" />
          <input
            placeholder="Search"
            aria-label="Search"
            className="search__input"
          />
        </div>
      </div>

      <nav className="sidebar__nav">
        {menu.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} className={({ isActive }) =>
              `sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`
            }>
              {({ isActive }) => (
                <>
                  <span className="sidebar__nav-icon">
                    <Icon />
                  </span>
                  <span className="sidebar__nav-label">{item.label}</span>
                  {isActive && <span className="sidebar__nav-active-indicator" />}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar__user">
        {loading ? (
          <div className="sidebar__user-skeleton"></div>
        ) : user ? (
          <div className="sidebar__user-container">
            <div className="sidebar__user-profile">
              <UserAvatar
                photoURL={user.photoURL}
                displayName={user.displayName}
                email={user.email}
                size={32}
              />
              <div className="sidebar__user-info">
                <div className="sidebar__user-name">
                  {user.displayName || user.email?.split('@')[0] || 'User'}
                </div>
                <div className="sidebar__user-email">
                  {user.email}
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="button button--danger button--full"
              aria-label="Log out"
            >
              <LogOut className="button__icon" />
              <span>Logout</span>
            </button>
          </div>
        ) : (
          <NavLink to="/login">
            <button className="button button--primary button--full">
              Log in
            </button>
          </NavLink>
        )}
      </div>
    </aside>
  );
}
