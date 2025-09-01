import type { Stream } from '../types/stream';
import Sidebar from './Sidebar';

interface Props {
  stream: Stream;
}

export default function LiveStreamCard({ stream }: Props) {
  return (
    <div className="relative w-full h-screen flex items-center justify-center bg-black">
      <video src={stream.videoUrl} controls autoPlay className="w-full h-full object-cover" />
      <div className="absolute bottom-16 left-4 text-white">
        <h2 className="text-2xl font-bold">{stream.title}</h2>
        <p className="text-lg">by {stream.streamer}</p>
        <span className="text-sm">{stream.viewers} watching</span>
      </div>
      <Sidebar />
    </div>
  );
}
