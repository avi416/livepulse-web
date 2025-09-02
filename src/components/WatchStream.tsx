import { useEffect, useRef, useState } from 'react';
import { watcherJoin } from '../services/webrtcService';
import { getStreamById } from '../services/streamService';
import type { LiveStreamDoc } from '../services/liveStreams';

interface Props { 
  streamId: string;
}

export default function WatchStream({ streamId }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<string>("Initializing...");
  const [streamInfo, setStreamInfo] = useState<LiveStreamDoc | null>(null);
  const [hasCohosts, setHasCohosts] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const maxConnectionAttempts = 3;

  useEffect(() => {
    let cleanup: (() => void) | null = null;
    let retryTimeout: NodeJS.Timeout | null = null;
    
    async function join(attempt = 0) {
      setIsLoading(true);
      setConnectionStatus(`Connecting to stream... (Attempt ${attempt + 1}/${maxConnectionAttempts})`);
      setError(null);
      
      try {
        // Get stream metadata
        console.log(`🔍 Fetching stream info for ID: ${streamId} (Attempt ${attempt + 1})`);
        const meta = await getStreamById(streamId);
        
        if (!meta) {
          setIsLoading(false);
          return setError('Stream not found or no longer active');
        }
        
        setStreamInfo(meta);
        console.log("📊 Stream metadata:", meta);
        
        // Check if this stream has any co-hosts
        if (meta.cohosts && Object.keys(meta.cohosts || {}).length > 0) {
          console.log('👥 Stream has co-hosts:', meta.cohosts);
          setHasCohosts(true);
        }
        
        if (!videoRef.current) {
          setIsLoading(false);
          return setError('Video element not available');
        }
        
        // Prepare video element
        setConnectionStatus("Preparing video element...");
        
        // Ensure video element is ready with proper attributes
        videoRef.current.autoplay = true;
        videoRef.current.playsInline = true;
        videoRef.current.controls = true;
        videoRef.current.muted = true; // Initially muted to help with autoplay
        
        // Join the WebRTC session
        console.log('🔄 Joining WebRTC session for stream:', streamId);
        setConnectionStatus("Establishing WebRTC connection...");
        
        const res = await watcherJoin(streamId, videoRef.current);
        cleanup = res.cleanup;
        
        console.log('✅ Successfully joined WebRTC session');
        setConnectionStatus("Connected! Starting stream...");
        
        // Try to play the video after connection
        if (videoRef.current) {
          try {
            await videoRef.current.play();
            console.log('▶️ Video playback started successfully');
          } catch (playError) {
            console.warn('⚠️ Autoplay prevented:', playError);
            setConnectionStatus("Touch screen or press any key to start playback");
          }
        }
        
        setIsLoading(false);
      } catch (e: any) {
        console.error('❌ Error joining stream:', e);
        
        if (attempt < maxConnectionAttempts - 1) {
          console.log(`🔄 Retrying connection (${attempt + 1}/${maxConnectionAttempts})...`);
          setConnectionStatus(`Connection failed. Retrying in 3 seconds... (${attempt + 1}/${maxConnectionAttempts})`);
          
          // Retry after a delay
          retryTimeout = setTimeout(() => {
            setConnectionAttempts(attempt + 1);
            join(attempt + 1);
          }, 3000);
        } else {
          setIsLoading(false);
          setError(`Failed to join stream after ${maxConnectionAttempts} attempts: ${e.message || 'Unknown error'}`);
        }
      }
    }
    
    join(connectionAttempts);
    
    return () => { 
      try {
        if (retryTimeout) clearTimeout(retryTimeout);
        console.log('🧹 Cleaning up WebRTC session');
        cleanup?.(); 
      } catch (e) {
        console.error('❌ Error during cleanup:', e);
      } 
    };
  }, [streamId, connectionAttempts, maxConnectionAttempts]);

  if (error) {
    return (
      <div className="p-5 bg-red-50 border-2 border-red-200 rounded-lg shadow-md text-center">
        <h3 className="text-xl font-bold text-red-700 mb-2">Stream Error</h3>
        <p className="text-red-600">{error}</p>
        <p className="mt-3 text-gray-700">
          The stream may have ended or is experiencing technical difficulties.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-5 bg-blue-50 border-2 border-blue-200 rounded-lg shadow-md text-center">
        <div className="flex justify-center mb-3">
          <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <h3 className="text-xl font-bold text-blue-700 mb-2">
          <span className="animate-pulse">LIVE</span>
        </h3>
        <p className="text-gray-700 mb-2">{connectionStatus}</p>
        {connectionAttempts > 0 && (
          <p className="text-sm text-blue-600">
            Connection attempt {connectionAttempts + 1} of {maxConnectionAttempts}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`${hasCohosts ? 'max-w-[1200px]' : 'max-w-[600px]'} w-full mx-auto transition-all duration-500`}>
      <div className="rounded-lg overflow-hidden shadow-lg border-2 border-blue-300 bg-black">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          controls 
          className="w-full h-auto bg-black" 
          style={{ minHeight: '400px' }}
        />
      </div>
      
      {streamInfo && (
        <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-800 mb-1">
            {streamInfo.title || 'Live Stream'}
          </h3>
          <div className="flex items-center text-sm text-gray-600">
            <span className="mr-2">Hosted by:</span>
            <span className="font-medium">{streamInfo.hostName || 'Unknown host'}</span>
            {hasCohosts && (
              <span className="ml-3 px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">
                With Co-hosts
              </span>
            )}
          </div>
          {streamInfo.description && (
            <p className="mt-2 text-gray-700">{streamInfo.description}</p>
          )}
        </div>
      )}
    </div>
  );
}
