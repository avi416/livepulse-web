import { useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, Search, PlusCircle, Users, User } from 'lucide-react';
import Topbar from '../components/layout/Topbar';
import LeftNav from '../components/layout/LeftNav';
import ActionRail from '../components/layout/ActionRail';

export default function AppShell() {
  useEffect(() => {
    // Always use dark theme to match the design
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <div className="app-shell">
      <header className="topbar">
        <Topbar />
      </header>

      <nav className="left-nav">
        <LeftNav />
      </nav>

      <main className="main-content">
        <Outlet />
      </main>

      <aside className="action-rail">
        <ActionRail />
      </aside>

      <div className="mobile-nav">
        <Link to="/" className={`mobile-nav__item ${currentPath === '/' ? 'mobile-nav__item--active' : ''}`}>
          <span className="mobile-nav__icon">
            <Home size={24} strokeWidth={2} />
          </span>
          <span className="mobile-nav__label">Home</span>
        </Link>
        <Link to="/explore" className={`mobile-nav__item ${currentPath === '/explore' ? 'mobile-nav__item--active' : ''}`}>
          <span className="mobile-nav__icon">
            <Search size={24} strokeWidth={2} />
          </span>
          <span className="mobile-nav__label">Discover</span>
        </Link>
        <Link to="/live/go" className={`mobile-nav__item ${currentPath === '/live/go' ? 'mobile-nav__item--active' : ''}`}>
          <span className="mobile-nav__icon">
            <PlusCircle size={24} strokeWidth={2} />
          </span>
          <span className="mobile-nav__label">Create</span>
        </Link>
        <Link to="/following" className={`mobile-nav__item ${currentPath === '/following' ? 'mobile-nav__item--active' : ''}`}>
          <span className="mobile-nav__icon">
            <Users size={24} strokeWidth={2} />
          </span>
          <span className="mobile-nav__label">Following</span>
        </Link>
        <Link to="/profile/me" className={`mobile-nav__item ${currentPath.startsWith('/profile') ? 'mobile-nav__item--active' : ''}`}>
          <span className="mobile-nav__icon">
            <User size={24} strokeWidth={2} />
          </span>
          <span className="mobile-nav__label">Profile</span>
        </Link>
      </div>
    </div>
  );
}
