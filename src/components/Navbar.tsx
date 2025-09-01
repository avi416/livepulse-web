import { Search, Video } from 'lucide-react';
import { useState } from 'react';
import UserAvatar from './UserAvatar';
import useAuthUser from '../hooks/useAuthUser';
import { getAuthInstance } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

export default function Navbar() {
  const { user } = useAuthUser();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  async function handleSignOut() {
    const auth = getAuthInstance();
    await signOut(auth);
    navigate('/login');
  }

  return (
    <nav className="flex items-center justify-between px-4 py-3 bg-black text-white">
      <div className="live-take-title text-[#ff0000]">LIVE TAKE</div>

      <div className="flex items-center gap-2 bg-gray-800 px-2 py-1 rounded-lg">
        <Search size={18} />
        <input
          type="text"
          placeholder="Search live..."
          className="bg-transparent outline-none text-sm"
        />
      </div>

      <div className="flex items-center gap-4 relative">
        <Video className="cursor-pointer" />

        {user ? (
          <div className="relative">
            <button
              onClick={() => setOpen((s) => !s)}
              className="focus:outline-none"
              aria-haspopup="true"
              aria-expanded={open}
            >
              <UserAvatar
                photoURL={user.photoURL}
                displayName={user.displayName}
                email={user.email}
                size={40}
              />
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-40 bg-white text-black rounded-md shadow-lg py-1 z-50">
                <button
                  className="w-full text-left px-4 py-2 hover:bg-gray-100"
                  onClick={() => navigate('/profile/me')}
                >
                  Profile
                </button>
                <button
                  className="w-full text-left px-4 py-2 hover:bg-gray-100"
                  onClick={handleSignOut}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/login')}
              className="px-3 py-1 rounded-md bg-sky-600 hover:bg-sky-500"
            >
              Login
            </button>
            <button
              onClick={() => navigate('/signup')}
              className="px-3 py-1 rounded-md border border-slate-600"
            >
              Sign up
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
