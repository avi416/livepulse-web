import { useLiveStreams } from '../hooks/useLiveStreams';
import LiveStreamCard from './LiveStreamCard';
import Topbar from './Topbar';

export default function Feed() {
  const { streams, loading, error } = useLiveStreams();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="relative w-full h-screen overflow-y-scroll">
      <Topbar />
      <div className="flex flex-col">
        {streams.map(stream => (
          <LiveStreamCard key={stream.id} stream={stream} />
        ))}
      </div>
    </div>
  );
}
