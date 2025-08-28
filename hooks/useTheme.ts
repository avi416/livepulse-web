import { useEffect, useState } from 'react';

export function useTheme() {
  const [dark, setDark] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('theme');
      if (v) return v === 'dark';
    } catch {}
    return false;
  });
  const [rtl, setRtl] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('rtl');
      if (v) return v === '1';
    } catch {}
    return false;
  });

  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
      localStorage.setItem('theme', dark ? 'dark' : 'light');
    } catch {}
  }, [dark]);

  useEffect(() => {
    try {
      document.documentElement.dir = rtl ? 'rtl' : 'ltr';
      localStorage.setItem('rtl', rtl ? '1' : '0');
    } catch {}
  }, [rtl]);

  return { dark, setDark, rtl, setRtl };
}
