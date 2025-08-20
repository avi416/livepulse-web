import React from 'react';
import { useTheme } from '../hooks/useTheme';

export default function Settings() {
  const { dark, setDark, rtl, setRtl } = useTheme();

  return (
    <div className="pt-12 max-w-3xl mx-auto p-4">
      <h2 className="text-xl font-semibold">Settings</h2>
      <div className="mt-4">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={dark} onChange={() => setDark(!dark)} />
          Dark mode
        </label>
      </div>
      <div className="mt-2">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={rtl} onChange={() => setRtl(v => !v)} />
          RTL / Language direction
        </label>
      </div>
    </div>
  );
}
