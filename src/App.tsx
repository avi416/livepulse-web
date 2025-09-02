import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';
import AppShell from './app/AppShell';
import Home from './pages/Home';
import Following from './pages/Following';
import Explore from './pages/Explore';
import Profile from './pages/Profile';
import GoLive from './pages/GoLive';
import LiveHub from './pages/LiveHub';
import LiveWatch from './pages/LiveWatch';
import LiveViewer from './pages/LiveViewer';
import WatchStream from './pages/WatchStream';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';
import Register from './pages/Register';
import Login from './pages/Login';
import Viewer from "./pages/Viewer";
// Register cohost components - critical for ensuring they're included in the build
import './components/cohost';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<Home />} />
            <Route path="following" element={
              <ProtectedRoute>
                <Following />
              </ProtectedRoute>
            } />
            <Route path="explore" element={<Explore />} />
            <Route path="profile/:handle" element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } />
            <Route path="live" element={
              <ProtectedRoute>
                <LiveHub />
              </ProtectedRoute>
            } />
            <Route path="live/watch" element={
              <ProtectedRoute>
                <LiveWatch />
              </ProtectedRoute>
            } />
            <Route path="live/go" element={
              <ProtectedRoute>
                <GoLive />
              </ProtectedRoute>
            } />
            <Route path="live/watch/:id" element={
              <ProtectedRoute>
                <LiveViewer />
              </ProtectedRoute>
            } />
            <Route path="settings" element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } />
            <Route path="signup" element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            } />
            <Route path="login" element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Route>
          
          {/* Public route for watching streams - no authentication required */}
          <Route path="/watch/:id" element={<WatchStream />} />

          {/* Public route for testing Viewer manually */}
          <Route path="/viewer" element={<Viewer />} /> {/* 👈 כאן מוסיפים */}
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
