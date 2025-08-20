import LiveCard from './feed/LiveCard';
import type { Live } from '../types/live';

const demoLives: Live[] = [
  {
    id: '1',
    thumbnail: 'https://placehold.co/300x200?text=Live+1',
    title: 'Gaming with Avi',
    userHandle: 'avigamer',
    userName: 'Avi Gamer',
    viewers: 120,
    tags: ['gaming', 'fun'],
    isLive: true,
  },
  {
    id: '2',
    thumbnail: 'https://placehold.co/300x200?text=Live+2',
    title: 'Chill Music Stream',
    userHandle: 'lofibeats',
    userName: 'LoFi Beats',
    viewers: 45,
    tags: ['music', 'chill'],
    isLive: true,
  },
  {
    id: '3',
    thumbnail: 'https://placehold.co/300x200?text=Live+3',
    title: 'Cooking Live',
    userHandle: 'chefdan',
    userName: 'Chef Dan',
    viewers: 87,
    tags: ['cooking', 'food'],
    isLive: true,
  },
];

export default function LiveFeed() {
  return (
    <div className="flex flex-wrap justify-center gap-6 p-6 bg-gray-100 min-h-screen">
      {demoLives.map((live) => (
        <LiveCard key={live.id} live={live} />
      ))}
    </div>
  );
}
