import { useState } from 'react';
import type { CoHostConnection } from '../../types/cohost';

interface HostCohostControllerProps {
  cohosts: CoHostConnection[];
  onRemove: (uid: string) => void;
  onToggleMute: (uid: string, mute: boolean) => void;
}

export default function HostCohostController({
  cohosts,
  onRemove,
  onToggleMute
}: HostCohostControllerProps) {
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const handleRemove = async (uid: string) => {
    setActionInProgress(uid);
    try {
      await onRemove(uid);
    } catch (error) {
      console.error('❌ Failed to remove co-host:', error);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleToggleMute = async (uid: string, currentMuted: boolean) => {
    setActionInProgress(uid);
    try {
      await onToggleMute(uid, !currentMuted);
    } catch (error) {
      console.error('❌ Failed to toggle mute:', error);
    } finally {
      setActionInProgress(null);
    }
  };

  if (cohosts.length === 0) {
    return (
      <div className="mt-4 p-3 bg-[var(--panel)] rounded-md">
        <h3 className="text-lg font-medium">Co-hosts</h3>
        <p className="text-sm text-[var(--muted)] mt-2">No active co-hosts.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 p-3 bg-[var(--panel)] rounded-md">
      <h3 className="text-lg font-medium">Co-hosts</h3>
      <div className="space-y-4 mt-3">
        {cohosts.map((cohost) => (
          <div key={cohost.uid} className="p-3 bg-[var(--background)] rounded-md">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center">
                <span className="font-medium">Co-host: {cohost.uid.substring(0, 6)}...</span>
                <span className={`ml-2 px-2 py-0.5 text-xs rounded ${cohost.isMuted ? 'bg-yellow-600' : 'bg-green-600'} text-white`}>
                  {cohost.isMuted ? 'Muted' : 'Live'}
                </span>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleToggleMute(cohost.uid, cohost.isMuted)}
                  disabled={actionInProgress === cohost.uid}
                  className={`px-2 py-1 ${cohost.isMuted ? 'bg-yellow-600' : 'bg-green-600'} text-white rounded text-sm`}
                >
                  {cohost.isMuted ? 'Unmute' : 'Mute'}
                </button>
                <button
                  onClick={() => handleRemove(cohost.uid)}
                  disabled={actionInProgress === cohost.uid}
                  className="px-2 py-1 bg-red-600 text-white rounded text-sm"
                >
                  Remove
                </button>
              </div>
            </div>
            
            {/* Co-host video stream - small preview in the controller */}
            <div className="aspect-video w-full bg-black rounded overflow-hidden">
              {cohost.stream ? (
                <video
                  autoPlay
                  playsInline
                  muted={cohost.isMuted}
                  className="w-full h-full object-contain"
                  ref={(el) => {
                    if (el && cohost.stream && el.srcObject !== cohost.stream) {
                      console.log(`✅ Setting video element for co-host ${cohost.uid} in controller`, {
                        streamTracks: cohost.stream.getTracks().map(t => ({
                          kind: t.kind,
                          enabled: t.enabled,
                          id: t.id
                        }))
                      });
                      el.srcObject = cohost.stream;
                      
                      // Try to play the video
                      el.play().catch(err => {
                        console.warn("⚠️ Could not autoplay co-host video in controller:", err);
                      });
                    }
                  }}
                />
              ) : (
                <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                  <p className="text-white">No video stream available</p>
                </div>
              )}
              
              {/* Status overlay */}
              <div className="absolute top-2 left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                {cohost.stream ? 'LIVE' : 'NO STREAM'}
              </div>
              
              {/* Muted indicator */}
              {cohost.isMuted && cohost.stream && (
                <div className="absolute bottom-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                  MUTED
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
