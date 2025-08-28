// Minimal API wrapper and mock generator for feed items.
export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Network error');
  return res.json();
}

import type { Live } from '../types/live';

export function generateMockLives(page = 0, pageSize = 5): Live[] {
  const start = page * pageSize;
  return Array.from({ length: pageSize }).map((_, i) => {
    const idx = start + i;
    const isFollowed = idx % 4 === 0;
    const live: Live = {
      id: `live_${idx}`,
      userHandle: isFollowed ? `f_alice${idx}` : `user${idx}`,
      userName: isFollowed ? `Alice ${idx}` : `User ${idx}`,
      title: `Demo live #${idx}`,
      viewers: 50 + idx * 7,
      tags: ['music', 'gaming', 'chat'].slice(0, (idx % 3) + 1),
      thumbnail: `https://picsum.photos/seed/live_${idx}/720/1280`,
      isLive: true,
      startedAt: Date.now() - idx * 1000 * 60,
      isFollowed,
    };
    return live;
  });
}

