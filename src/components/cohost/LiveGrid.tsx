import React, { useEffect, useState } from 'react';
import type { CoHostConnection } from '../../types/cohost';

interface LiveGridProps {
  hostVideoRef: React.RefObject<HTMLVideoElement | null>;
  cohosts: CoHostConnection[];
}

/**
 * LiveGrid - Displays the host and co-host videos in a side-by-side grid layout
 * Shows both streams prominently for better collaboration
 */
export default function LiveGrid({ hostVideoRef, cohosts }: LiveGridProps) {
  const hasActiveCohost = cohosts.length > 0;
  const [layoutMode, setLayoutMode] = useState<'single' | 'dual'>(hasActiveCohost ? 'dual' : 'single');

  // Update layout mode when cohosts change
  useEffect(() => {
    // Use a short delay to create a nice transition effect
    const timer = setTimeout(() => {
      setLayoutMode(hasActiveCohost ? 'dual' : 'single');
    }, 200);

    return () => clearTimeout(timer);
  }, [hasActiveCohost]);

  return (
    <div className="mb-6">
      <h3 className="text-xl font-bold mb-3 text-gray-800 flex items-center">
        <span className="text-blue-500 mr-2">📺</span> Live Broadcast
        {hasActiveCohost && (
          <span className="ml-3 px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full shadow-sm animate-pulse">
            Co-host Active
          </span>
        )}
      </h3>
      
      <div 
        className={`grid gap-4 mb-4 transition-all duration-500 ease-in-out ${
          layoutMode === 'dual' ? 'grid-cols-2 max-w-[1200px]' : 'grid-cols-1 max-w-[600px]'
        } w-full`}
        style={{
          boxShadow: hasActiveCohost ? '0 4px 20px rgba(0, 0, 0, 0.1)' : 'none',
          padding: hasActiveCohost ? '16px' : '0',
          background: hasActiveCohost ? 'linear-gradient(to right, rgba(239, 246, 255, 0.6), rgba(236, 253, 245, 0.6))' : 'transparent',
          borderRadius: '8px',
          border: hasActiveCohost ? '1px solid rgba(147, 197, 253, 0.3)' : 'none'
        }}
      >
        {/* Host Video */}
        <div className="relative rounded-lg overflow-hidden shadow-lg bg-black border-2 border-blue-300 transition-all duration-300 transform hover:scale-[1.01]">
          <div className="absolute top-2 left-2 bg-gradient-to-r from-blue-600 to-blue-400 text-white text-xs font-bold px-3 py-1 rounded-full z-10 shadow-md">
            HOST
          </div>
          <video
            ref={hostVideoRef}
            autoPlay
            playsInline
            controls
            muted
            className="w-full h-full object-contain min-h-[400px]"
            style={{ objectFit: 'contain' }}
            onLoadedMetadata={(e) => {
              console.log('📊 Host video metadata loaded in LiveGrid:', {
                width: e.currentTarget.videoWidth,
                height: e.currentTarget.videoHeight
              });
            }}
            onPlay={() => {
              console.log('▶️ Host video is now playing in LiveGrid');
            }}
          />
        </div>
        
        {/* Co-host Video (if any) */}
        {hasActiveCohost && (
          <div className="relative rounded-lg overflow-hidden shadow-lg bg-black border-2 border-green-300 transition-all duration-300 transform hover:scale-[1.01]">
            <div className="absolute top-2 left-2 bg-gradient-to-r from-green-600 to-green-400 text-white text-xs font-bold px-3 py-1 rounded-full z-10 shadow-md">
              CO-HOST
            </div>
            <video
              key={cohosts[0].uid} // Key helps React recognize when to refresh the element
              autoPlay
              playsInline
              controls
              muted={cohosts[0].isMuted}
              className="w-full h-full object-contain min-h-[400px]"
              style={{ objectFit: 'contain' }}
              ref={(el) => {
                if (el && cohosts[0].stream) {
                  // Always set srcObject to ensure video updates
                  console.log("✅ Setting co-host video in LiveGrid component", {
                    uid: cohosts[0].uid,
                    hasStream: !!cohosts[0].stream,
                    trackCount: cohosts[0].stream?.getTracks().length
                  });
                  
                  // Force refresh the stream object
                  el.srcObject = null;
                  el.srcObject = cohosts[0].stream;
                  
                  // Try to play the video (handles autoplay restrictions)
                  el.play().catch(err => {
                    console.warn("⚠️ Could not autoplay co-host video:", err);
                    
                    // Try again after a short delay
                    setTimeout(() => {
                      el.play().catch(delayedErr => {
                        console.warn("⚠️ Still could not autoplay co-host video after delay:", delayedErr);
                      });
                    }, 1000);
                  });
                  
                  // Log when video is actually playing
                  el.onplaying = () => {
                    console.log('▶️ Co-host video is now playing in LiveGrid');
                  };
                  
                  // Log metadata when loaded
                  el.onloadedmetadata = () => {
                    console.log('📊 Co-host video metadata loaded in LiveGrid:', {
                      width: el.videoWidth,
                      height: el.videoHeight
                    });
                  };
                }
              }}
            />
            
            {/* Mute indicator */}
            {cohosts[0].isMuted && (
              <div className="absolute bottom-2 right-2 bg-gradient-to-r from-red-600 to-red-400 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md flex items-center">
                <span className="mr-1">🔇</span> MUTED
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Co-host info and mini controls */}
      {hasActiveCohost && (
        <div className="p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-md mb-4 shadow-sm border border-blue-100 transition-all duration-300">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-full mr-3 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                {cohosts[0].displayName?.substring(0, 1).toUpperCase() || cohosts[0].uid.substring(0, 1).toUpperCase()}
              </div>
              <div>
                <span className="font-medium text-gray-800">
                  {cohosts[0].displayName || cohosts[0].uid.substring(0, 6)}...
                </span>
                <div className="text-sm text-gray-500 flex items-center">
                  <span className="mr-1">👤</span> Co-hosting your stream
                </div>
              </div>
            </div>
            <div className="flex items-center bg-white px-3 py-1 rounded-full shadow-sm border border-gray-200">
              <div className={`w-3 h-3 ${cohosts[0].stream ? 'bg-green-500' : 'bg-red-500'} rounded-full mr-2 ${cohosts[0].stream ? 'animate-pulse' : ''}`}></div>
              <span className="text-sm font-medium">{cohosts[0].stream ? 'Live' : 'No stream'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
