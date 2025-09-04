import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import SearchBar from '../common/SearchBar';
import UserAvatar from '../UserAvatar';
import ThemeToggle from '../ThemeToggle';
import { useAuth } from '../../contexts/AuthContext';
import { getAuthInstance } from '../../services/firebase';

export default function Topbar() {
  const { user, loading } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      const auth = getAuthInstance();
      await signOut(auth);
      setShowDropdown(false);
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleProfileClick = () => {
    setShowDropdown(false);
    navigate('/profile/me');
  };

  return (
    <div className="topbar__container">
      <div className="topbar__logo">
        <Link to="/" className="topbar__logo-link">LivePulse</Link>
      </div>

      <div className="topbar__search">
        <SearchBar />
      </div>

      <div className="topbar__user">
        <ThemeToggle />

        {loading ? (
          <div className="avatar avatar--md skeleton" />
        ) : user ? (
          <div className="topbar__user-menu" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="avatar avatar--md avatar--bordered"
              aria-label="User menu"
            >
              <UserAvatar
                photoURL={user.photoURL}
                displayName={user.displayName}
                email={user.email}
                size={36}
              />
            </button>

            {showDropdown && (
              <div className="dropdown">
                <button
                  onClick={handleProfileClick}
                  className="dropdown__item"
                >
                  Profile
                </button>
                <button
                  onClick={handleLogout}
                  className="dropdown__item"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            to="/login"
            className="button button--primary"
            aria-label="Sign in"
          >
            Sign In
          </Link>
        )}
      </div>
    </div>
  );
}
