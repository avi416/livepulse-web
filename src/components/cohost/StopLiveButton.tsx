import { useState } from 'react';
import { endLiveStream } from '../../services/streamService';

interface StopLiveButtonProps {
  liveId: string;
  onEnded?: () => void;
}

export default function StopLiveButton({ liveId, onEnded }: StopLiveButtonProps) {
  const [isEnding, setIsEnding] = useState(false);

  const handleEndLive = async () => {
    if (window.confirm('Are you sure you want to end this live stream?')) {
      setIsEnding(true);
      try {
        await endLiveStream(liveId);
        console.log('✅ Live stream ended');
        onEnded?.();
      } catch (error) {
        console.error('❌ Failed to end live stream:', error);
      } finally {
        setIsEnding(false);
      }
    }
  };

  return (
    <button
      onClick={handleEndLive}
      disabled={isEnding}
      className="px-4 py-2 bg-red-600 text-white rounded-md flex items-center hover:bg-red-700"
    >
      {isEnding ? 'Ending...' : 'End Live Stream'}
    </button>
  );
}
