import { useRef, useState, useCallback, useEffect } from 'react';

type UseLocalMedia = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  start: () => Promise<MediaStream>;
  stop: () => void;
  isActive: boolean;
  error: string | null;
  stream: MediaStream | null;
};

export function useLocalMedia(): UseLocalMedia {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async () => {
    setError(null);
    
    // If we already have a stream, return it
    if (streamRef.current) {
      console.log('🎥 Using existing media stream');
      return streamRef.current;
    }
    
    try {
      console.log('🎥 Requesting camera and microphone permissions...');
      
      // First try with both video and audio
      let s: MediaStream;
      try {
        s = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          }, 
          audio: true 
        });
        console.log('✅ Got access to both camera and microphone');
      } catch (err) {
        console.warn('⚠️ Failed to get both camera and microphone, trying with just camera:', err);
        
        // Fallback to just video if audio fails
        try {
          s = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              width: { ideal: 640 },
              height: { ideal: 480 },
              facingMode: 'user' 
            }, 
            audio: false 
          });
          console.log('✅ Got access to camera only');
        } catch (videoErr) {
          console.warn('⚠️ Failed to get camera, trying with just audio:', videoErr);
          
          // Last resort: try just audio
          try {
            s = await navigator.mediaDevices.getUserMedia({ 
              video: false, 
              audio: true 
            });
            console.log('✅ Got access to microphone only');
          } catch (audioErr) {
            console.error('❌ Failed to access any media devices:', audioErr);
            throw new Error('Could not access camera or microphone. Please check your permissions.');
          }
        }
      }
      
      // Log details about the tracks we got
      const videoTracks = s.getVideoTracks();
      const audioTracks = s.getAudioTracks();
      
      console.log(`✅ Media access granted with ${videoTracks.length} video tracks and ${audioTracks.length} audio tracks`);
      
      // Ensure all tracks are enabled
      s.getTracks().forEach(track => {
        track.enabled = true;
        console.log(`✅ Enabled track: ${track.kind} (${track.label || track.id})`);
      });
      
      if (videoTracks.length > 0) {
        const vTrack = videoTracks[0];
        // Make sure the video track is enabled
        vTrack.enabled = true;
        console.log('📹 Video track:', {
          label: vTrack.label,
          enabled: vTrack.enabled,
          muted: vTrack.muted,
          readyState: vTrack.readyState,
          settings: vTrack.getSettings()
        });
      }
      
      if (audioTracks.length > 0) {
        const aTrack = audioTracks[0];
        // Make sure the audio track is enabled
        aTrack.enabled = true;
        console.log('🎤 Audio track:', {
          label: aTrack.label,
          enabled: aTrack.enabled,
          muted: aTrack.muted,
          readyState: aTrack.readyState
        });
      }
      
      // Store the stream in refs and state
      streamRef.current = s;
      setStream(s);
      
      // If we have a video reference, attach the stream
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        
        // Try to play the video to ensure it's working
        try {
          await videoRef.current.play();
          console.log('▶️ Local video preview playing');
        } catch (playErr) {
          console.warn('⚠️ Could not autoplay local video preview:', playErr);
          // Not critical, user can click play
        }
      }
      
      setIsActive(true);
      return s;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to access media devices';
      console.error('❌ Media access error:', msg);
      setError(msg);
      setIsActive(false);
      throw err; // Re-throw to let caller handle it
    }
  }, []);

  const stop = useCallback(() => {
    if (stream) {
      console.log(`🛑 Stopping ${stream.getTracks().length} media tracks`);
      stream.getTracks().forEach((track) => {
        console.log(`🛑 Stopping ${track.kind} track: ${track.label || track.id}`);
        track.stop();
      });
    }
    
    if (videoRef.current) {
      console.log('🧹 Clearing video srcObject');
      videoRef.current.srcObject = null;
    }
    
    streamRef.current = null;
    setStream(null);
    setIsActive(false);
    console.log('✅ Local media completely stopped');
  }, [stream]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        console.log('🧹 Auto-cleaning media on unmount');
        stop();
      }
    };
  }, [stop]);

  return { videoRef, start, stop, isActive, error, stream };
}
