import React from 'react';
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

  return (
    <div className="mb-6">
      <h3 className="text-xl font-bold mb-3 text-gray-800">Live Broadcast</h3>
      
      <div className={`grid ${hasActiveCohost ? 'md:grid-cols-2' : 'grid-cols-1'} gap-4 mb-4`}>
        {/* Host Video */}
        <div className="relative rounded-lg overflow-hidden shadow-lg bg-black">
          <div className="absolute top-2 left-2 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded z-10">
            HOST
          </div>
          <video
            ref={hostVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover min-h-[300px]"
          />
        </div>
        
        {/* Co-host Video (if any) */}
        {hasActiveCohost && (
          <div className="relative rounded-lg overflow-hidden shadow-lg bg-black">
            <div className="absolute top-2 left-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded z-10">
              CO-HOST
            </div>
            <video
              key={cohosts[0].uid} // Key helps React recognize when to refresh the element
              autoPlay
              playsInline
              muted={cohosts[0].isMuted}
              className="w-full h-full object-cover min-h-[300px]"
              ref={(el) => {
                if (el && cohosts[0].stream && el.srcObject !== cohosts[0].stream) {
                  console.log("✅ Setting co-host video in LiveGrid component", {
                    uid: cohosts[0].uid,
                    hasStream: !!cohosts[0].stream,
                    trackCount: cohosts[0].stream?.getTracks().length
                  });
                  el.srcObject = cohosts[0].stream;
                  
                  // Try to play the video (handles autoplay restrictions)
                  el.play().catch(err => {
                    console.warn("⚠️ Could not autoplay co-host video:", err);
                  });
                }
              }}
            />
            
            {/* Mute indicator */}
            {cohosts[0].isMuted && (
              <div className="absolute bottom-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                MUTED
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Co-host info and mini controls */}
      {hasActiveCohost && (
        <div className="p-3 bg-gray-100 rounded-md mb-4 shadow-sm">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <div className="w-6 h-6 bg-green-500 rounded-full mr-2 flex items-center justify-center text-white text-xs">
                {cohosts[0].uid.substring(0, 1).toUpperCase()}
              </div>
              <span className="font-medium">Co-host: {cohosts[0].uid.substring(0, 6)}...</span>
            </div>
            <div className="flex items-center">
              <div className={`w-2 h-2 ${cohosts[0].stream ? 'bg-green-500' : 'bg-red-500'} rounded-full mr-1`}></div>
              <span className="text-xs">{cohosts[0].stream ? 'Connected' : 'No stream'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
