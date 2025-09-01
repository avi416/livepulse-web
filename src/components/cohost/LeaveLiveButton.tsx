import { useState } from 'react';

interface LeaveLiveButtonProps {
  onLeave: () => void;
}

export default function LeaveLiveButton({ onLeave }: LeaveLiveButtonProps) {
  const [isLeaving, setIsLeaving] = useState(false);

  const handleLeaveLive = async () => {
    if (window.confirm('Are you sure you want to leave this live stream?')) {
      setIsLeaving(true);
      try {
        // Call the leave function passed from parent
        onLeave();
        console.log('✅ Left live stream');
      } catch (error) {
        console.error('❌ Failed to leave live stream:', error);
      } finally {
        setIsLeaving(false);
      }
    }
  };

  return (
    <button
      onClick={handleLeaveLive}
      disabled={isLeaving}
      className="px-4 py-2 bg-orange-600 text-white rounded-md flex items-center hover:bg-orange-700"
    >
      {isLeaving ? 'Leaving...' : 'Leave Stream'}
    </button>
  );
}
