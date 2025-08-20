import React from 'react';
import SearchBar from '../common/SearchBar';
import '../../styles/components/Topbar.css';
import { Link } from 'react-router-dom';

export default function Topbar() {
  return (
    <header className="fixed top-0 left-0 w-full bg-white/90 h-14 z-20 backdrop-blur border-b">
      <div className="max-w-5xl mx-auto h-full px-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="font-extrabold text-blue-600 text-lg">LivePulse</Link>
        </div>
        <div className="flex-1 px-4">
          <SearchBar />
        </div>
        <div className="flex items-center gap-3">
          <button className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center" aria-label="profile">M</button>
        </div>
      </div>
    </header>
  );
}
