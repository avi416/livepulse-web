import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppShell from './app/AppShell';
import Home from './pages/Home';
import Following from './pages/Following';
import Explore from './pages/Explore';
import Profile from './pages/Profile';
import GoLive from './pages/GoLive';
import LiveHub from './pages/LiveHub';
import LiveWatch from './pages/LiveWatch';
import LiveViewer from './pages/LiveViewer';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';
import Register from './pages/Register';
import Login from './pages/Login';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<Home />} />
          <Route path="following" element={<Following />} />
          <Route path="explore" element={<Explore />} />
          <Route path="profile/:handle" element={<Profile />} />
          <Route path="live" element={<LiveHub />} />
          <Route path="live/watch" element={<LiveWatch />} />
          <Route path="live/go" element={<GoLive />} />
          <Route path="live/watch/:id" element={<LiveViewer />} />
          <Route path="settings" element={<Settings />} />
          <Route path="signup" element={<Register />} />
          <Route path="login" element={<Login />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
