import { Link, useLocation } from 'react-router-dom';
import { Home, Search, Users, Video, User, TvMinimalPlay } from 'lucide-react';
import '../../styles/components/LeftNav.css';

export default function LeftNav() {
  const location = useLocation();

  // Define navigation items with Lucide icons
  const navItems = [
    { path: '/', label: 'Home', icon: <Home size={24} strokeWidth={2} color={location.pathname === '/' ? '#ff2c55' : 'currentColor'} /> },
    { path: '/explore', label: 'Discover', icon: <Search size={24} strokeWidth={2} color={location.pathname === '/explore' ? '#ff2c55' : 'currentColor'} /> },
    { path: '/following', label: 'Following', icon: <Users size={24} strokeWidth={2} color={location.pathname === '/following' ? '#ff2c55' : 'currentColor'} /> },
    { path: '/live/go', label: 'Go Live', icon: <Video size={24} strokeWidth={2} color={location.pathname === '/live/go' ? '#ff2c55' : 'currentColor'} /> },
    { path: '/profile/me', label: 'Profile', icon: <User size={24} strokeWidth={2} color={location.pathname.startsWith('/profile') ? '#ff2c55' : 'currentColor'} /> },
  ];

  return (
    <nav className="left-nav__container">
      <div className="left-nav__logo">
        <Link to="/" className="left-nav__logo-link"><TvMinimalPlay /></Link>
      </div>
      <ul className="left-nav__list">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <li key={item.path} className="left-nav__item">
              <Link
                to={item.path}
                className={`nav-item ${isActive ? 'nav-item--active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="nav-item__icon">{item.icon}</span>
                <span className="nav-item__label">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
