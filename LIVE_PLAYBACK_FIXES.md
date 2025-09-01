# Live Playback Fixes - WebRTC Signaling & Viewer Connection

## Overview
This document describes the fixes implemented to resolve live playback issues where video was staying black. The solution involves robust WebRTC signaling between broadcaster and viewer using Firestore subcollections.

## Issues Fixed

### ❌ **Previous Problems**
- Video player showing black screen
- WebRTC connections not properly established
- Missing proper signaling between broadcaster and viewer
- "Invalid Date" errors in timestamp display
- Incomplete cleanup of WebRTC resources

### ✅ **Solutions Implemented**

## 1. WebRTC Service Overhaul (`src/services/webrtcService.ts`)

### New Signaling Architecture
- **Firestore Structure**: Uses subcollections for organized signaling
- **SDP Exchange**: `liveStreams/{id}/sdp/offer` and `liveStreams/{id}/sdp/answer`
- **ICE Candidates**: Separate collections for broadcaster and viewer candidates

### Key Functions

#### `connectAsViewer(liveId, videoEl)`
```typescript
// Robust viewer connection with proper error handling
export async function connectAsViewer(liveId: string, videoEl: HTMLVideoElement) {
  // 1. Verify stream is live
  // 2. Get offer SDP from broadcaster
  // 3. Create RTCPeerConnection with recvonly transceivers
  // 4. Handle ICE candidate exchange
  // 5. Create and publish answer
  // 6. Return cleanup function
}
```

#### `createBroadcasterPC(stream, streamId, onRemoteTrack)`
```typescript
// Enhanced broadcaster with proper track handling
export async function createBroadcasterPC(stream: MediaStream | null, streamId: string, onRemoteTrack?: (s: MediaStream) => void) {
  // 1. Add all tracks from local stream
  // 2. Create offer with offerToReceiveVideo/Audio
  // 3. Publish offer to Firestore
  // 4. Listen for viewer answer and ICE candidates
}
```

### Signaling Flow
```
Broadcaster                    Viewer
     |                           |
     |-- Create Offer ---------->|
     |-- ICE Candidates -------->|
     |<-- Answer ----------------|
     |<-- ICE Candidates --------|
     |-- Media Stream ---------->|
```

## 2. Broadcaster Updates (`src/pages/LiveStream.tsx`)

### Enhanced Track Handling
- **Explicit Track Addition**: Ensures video/audio tracks are properly added
- **Offer Creation**: Creates offer with `offerToReceiveVideo: true, offerToReceiveAudio: true`
- **Proper Cleanup**: Manages WebRTC listeners and connections

### Key Changes
```typescript
// Ensure tracks are added and offer is written where viewer expects
if (stream) {
  stream.getTracks().forEach(t => pc.addTrack(t, stream));
}

// Create offer and publish to Firestore
const offer = await pc.createOffer({ 
  offerToReceiveVideo: true, 
  offerToReceiveAudio: true 
});
await setDoc(doc(db, 'liveStreams', liveId, 'sdp', 'offer'), offer);
```

## 3. Viewer Page Updates (`src/pages/WatchStream.tsx`)

### Robust Connection Management
- **Real-time Status Monitoring**: Listens for stream status changes
- **Automatic Connection**: Connects when stream goes live
- **Proper Cleanup**: Disconnects when stream ends or component unmounts

### Key Features
```typescript
// Real-time stream monitoring
const unsub = onSnapshot(streamRef, async (snap) => {
  if (data.status === 'live' && !isConnected) {
    const result = await connectAsViewer(id, videoRef.current);
    setIsConnected(true);
    cleanupRef.current = result.cleanup;
  }
});

// Proper cleanup on unmount
useEffect(() => {
  return () => {
    if (cleanupRef.current) {
      cleanupRef.current();
    }
  };
}, []);
```

### Timestamp Fix
```typescript
// Helper function to format timestamp properly
const formatStartedAt = (startedAt: any) => {
  if (!startedAt) return 'Starting...';
  if (startedAt.toDate) {
    return `Started ${startedAt.toDate().toLocaleString()}`;
  }
  if (startedAt instanceof Date) {
    return `Started ${startedAt.toLocaleString()}`;
  }
  return 'Starting...';
};
```

## 4. Firestore Security Rules

### Required Permissions
```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /liveStreams/{id} {
      allow read: if true;               // Viewers can read stream metadata
      allow write: if request.auth != null && 
                   request.resource.data.uid == request.auth.uid; // Owner updates
      
      match /sdp/{doc} {
        allow read: if true;              // SDP exchange is public
        allow write: if true;             // Both parties can write SDP
      }
      
      match /candidates_broadcaster/{doc} {
        allow read: if true;              // ICE candidates are public
        allow write: if true;
      }
      
      match /candidates_viewers/{doc} {
        allow read: if true;
        allow write: if true;
      }
    }
  }
}
```

## 5. Technical Implementation Details

### WebRTC Configuration
```typescript
const iceServers: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];
```

### Transceiver Setup
```typescript
// Ensure we request media even if remote doesn't list transceivers
pc.addTransceiver('video', { direction: 'recvonly' });
pc.addTransceiver('audio', { direction: 'recvonly' });
```

### Media Stream Handling
```typescript
pc.ontrack = (e) => {
  e.streams[0]?.getTracks().forEach(t => remoteStream.addTrack(t));
  videoEl.srcObject = remoteStream;
  videoEl.muted = true;
  videoEl.playsInline = true;
  videoEl.autoplay = true;
  videoEl.play().catch(() => {});
};
```

## 6. Testing & Verification

### Test Scenarios
1. **Start Live Stream**: Go to `/live/go`, start broadcast
2. **View Live Stream**: Click live card on Home, navigate to `/watch/:id`
3. **Anonymous Viewing**: Works without authentication
4. **Real-time Updates**: Stream status changes are reflected immediately
5. **Clean Disconnection**: Proper cleanup when stream ends

### Expected Behavior
- ✅ Video plays automatically when stream is live
- ✅ No black screen issues
- ✅ Proper timestamp display ("Starting..." → actual time)
- ✅ Automatic connection/disconnection based on stream status
- ✅ Clean resource cleanup on unmount

## 7. Troubleshooting

### Common Issues & Solutions

#### Video Still Black
- Check browser console for WebRTC errors
- Verify Firestore permissions allow read/write to sdp and candidates
- Ensure broadcaster has active media stream with tracks

#### Connection Failures
- Verify STUN servers are accessible
- Check network connectivity and firewall settings
- Monitor Firestore for proper SDP exchange

#### Timestamp Issues
- Ensure `startedAt` field is properly set with `serverTimestamp()`
- Check Firestore data structure matches expected format

### Debug Information
```typescript
// Add to browser console for debugging
console.log('Stream data:', streamData);
console.log('WebRTC connection state:', pc?.connectionState);
console.log('Media tracks:', videoEl.srcObject);
```

## 8. Performance Considerations

### Optimization Features
- **Efficient Listeners**: Single `onSnapshot` per stream
- **Connection Pooling**: WebRTC connections properly managed
- **Memory Management**: Automatic cleanup of unused resources
- **Error Handling**: Graceful degradation for connection failures

### Resource Cleanup
```typescript
const cleanup = () => {
  unsubRemoteICE();
  pc.getSenders().forEach(s => s.track && s.track.stop());
  pc.getReceivers().forEach(r => r.track && r.track.stop());
  pc.close();
};
```

## Summary

The live playback issues have been resolved through:

1. **Robust WebRTC Signaling**: Proper SDP and ICE candidate exchange
2. **Enhanced Track Handling**: Explicit video/audio track management
3. **Real-time Status Monitoring**: Automatic connection/disconnection
4. **Proper Resource Cleanup**: Memory leak prevention
5. **Timestamp Fixes**: Proper Firestore timestamp handling
6. **Error Handling**: Graceful degradation and user feedback

The solution ensures that:
- ✅ Viewers can watch live streams without authentication
- ✅ Video plays automatically when streams are live
- ✅ Real-time updates work properly
- ✅ Resources are properly managed
- ✅ Error states are handled gracefully

Live streaming now works reliably for both broadcasters and viewers with proper WebRTC signaling and media handling. 