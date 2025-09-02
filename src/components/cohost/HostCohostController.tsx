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
      <div className="mt-4 p-4 bg-[var(--panel)] rounded-md shadow-md border border-gray-200 transition-all duration-300">
        <h3 className="text-lg font-medium flex items-center">
          <span className="text-blue-500 mr-2">👥</span> Co-hosts
        </h3>
        <p className="text-sm text-[var(--muted)] mt-2 p-3 bg-gray-50 rounded-md">No active co-hosts.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 bg-[var(--panel)] rounded-md shadow-md border border-blue-200 transition-all duration-300">
      <h3 className="text-lg font-medium flex items-center">
        <span className="text-blue-500 mr-2">👥</span> Co-hosts
        <span className="ml-2 px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full shadow-md">
          {cohosts.length} Active
        </span>
      </h3>
      <div className="space-y-4 mt-3">
        {cohosts.map((cohost) => (
          <div key={cohost.uid} className="p-4 bg-[var(--background)] rounded-md border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center">
                <span className="font-medium text-gray-800">
                  {cohost.displayName || cohost.uid.substring(0, 6)}...
                </span>
                <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${cohost.isMuted ? 'bg-yellow-600' : 'bg-green-600'} text-white`}>
                  {cohost.isMuted ? 'Muted' : 'Live'}
                </span>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleToggleMute(cohost.uid, cohost.isMuted)}
                  disabled={actionInProgress === cohost.uid}
                  className={`px-3 py-1 ${cohost.isMuted ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-500 hover:bg-green-600'} text-white rounded-md text-sm font-medium transition-colors duration-200 flex items-center`}
                >
                  <span className="mr-1">{cohost.isMuted ? '🔇' : '🔊'}</span>
                  {cohost.isMuted ? 'Unmute' : 'Mute'}
                </button>
                <button
                  onClick={() => handleRemove(cohost.uid)}
                  disabled={actionInProgress === cohost.uid}
                  className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm font-medium transition-colors duration-200 flex items-center"
                >
                  <span className="mr-1">✕</span> Remove
                </button>
              </div>
            </div>
            
            {/* Co-host video stream - small preview in the controller */}
            <div className="aspect-video w-full bg-black rounded-md overflow-hidden relative shadow-md border border-gray-800">
              {cohost.stream ? (
                <video
                  autoPlay
                  playsInline
                  muted={cohost.isMuted}
                  className="w-full h-full object-contain"
                  style={{ objectFit: 'contain' }}
                  ref={(el) => {
                    if (el && cohost.stream) {
                      // Force new srcObject assignment every time to ensure video updates
                      console.log(`✅ Setting video element for co-host ${cohost.uid} in controller`, {
                        streamTracks: cohost.stream.getTracks().map(t => ({
                          kind: t.kind,
                          enabled: t.enabled,
                          id: t.id
                        }))
                      });
                      
                      // Always set srcObject to ensure updates
                      el.srcObject = cohost.stream;
                      
                      // Try to play the video
                      el.play().catch(err => {
                        console.warn("⚠️ Could not autoplay co-host video in controller:", err);
                        
                        // Try again after a short delay
                        setTimeout(() => {
                          el.play().catch(delayedErr => {
                            console.warn("⚠️ Still could not autoplay co-host video after delay:", delayedErr);
                          });
                        }, 1000);
                      });
                      
                      // Log when video is actually playing
                      el.onplaying = () => {
                        console.log(`▶️ Co-host ${cohost.uid} video is now playing in controller`);
                      };
                      
                      // Log metadata when loaded
                      el.onloadedmetadata = () => {
                        console.log(`📊 Co-host ${cohost.uid} video metadata loaded:`, {
                          width: el.videoWidth,
                          height: el.videoHeight
                        });
                      };
                    }
                  }}
                />
              ) : (
                <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                  <p className="text-white">No video stream available</p>
                </div>
              )}
              
              {/* Status overlay */}
              <div className="absolute top-2 left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full shadow-md">
                {cohost.stream ? 'LIVE' : 'NO STREAM'}
              </div>
              
              {/* Muted indicator */}
              {cohost.isMuted && cohost.stream && (
                <div className="absolute bottom-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full shadow-md flex items-center">
                  <span className="mr-1">🔇</span> MUTED
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
