import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="pt-12 max-w-3xl mx-auto p-4 text-center">
      <h2 className="text-2xl font-semibold">Page not found</h2>
      <p className="mt-2 text-gray-400">The page you're looking for doesn't exist.</p>
      <Link to="/" className="mt-4 inline-block px-4 py-2 bg-gray-800 rounded">Go home</Link>
    </div>
  );
}
