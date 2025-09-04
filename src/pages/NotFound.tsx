import { Link } from 'react-router-dom';
import '../styles/pages/NotFound.css';

export default function NotFound() {
  return (
    <div className="not-found">
      <h2 className="not-found__title">Page not found</h2>
      <p className="not-found__message">The page you're looking for doesn't exist.</p>
      <Link to="/" className="button button--secondary not-found__button">Go home</Link>
    </div>
  );
}
