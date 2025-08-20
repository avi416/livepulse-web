import { useEffect } from 'react';
import '../styles/components/AppShell.css';
import { Outlet } from 'react-router-dom';
// removed Topbar per request
import LeftNav from '../components/layout/LeftNav';
import ActionRail from '../components/layout/ActionRail';

export default function AppShell() {
  useEffect(() => {
    // default to dark theme for immersive view
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  return (
    <div className="appShell min-h-screen bg-[var(--bg)] text-white">
      <div className="pt-4">
        <div className="mx-auto max-w-[1300px] px-2 md:px-4 lg:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-[200px_minmax(560px,600px)_200px] xl:grid-cols-[240px_minmax(560px,600px)_260px] gap-4">
            <div className="lg:block"><LeftNav /></div>
            <main className="min-h-[calc(100vh-2rem)]"><Outlet /></main>
            <div className="lg:block"><ActionRail /></div>
          </div>
        </div>
      </div>
  {/* mobile bottom bar removed to keep sidebar fixed on left */}
    </div>
  );
}
