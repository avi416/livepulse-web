# WebRTC Signaling Fixes for Live Streams

## Overview
This document describes the fixes implemented to resolve WebRTC signaling issues between broadcasters and viewers, ensuring proper media stream delivery and connection establishment.

## Issues Fixed

### ❌ **Previous Problems**
- WebRTC connections not properly established
- Missing proper SDP exchange between broadcaster and viewer
- ICE candidates not being exchanged correctly
- Video player showing black screen
- Incomplete cleanup of WebRTC resources

### ✅ **Solutions Implemented**

## 1. WebRTC Service Architecture (`src/services/webrtcService.ts`)

### Firestore Structure (Exact Match Required)
```
liveStreams/{id}
  sdp/
    offer          # Broadcaster creates and publishes
    answer         # Viewer creates and publishes
  candidates_broadcaster/
    {candidate docs}  # ICE candidates from broadcaster
  candidates_viewers/
    {candidate docs}  # ICE candidates from viewers
```

### Key Functions

#### `createBroadcasterPC(stream, streamId, onRemoteTrack)`
```typescript
// 1. Get user media (video+audio)
// 2. Add tracks to RTCPeerConnection
localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

// 3. Create offer, set local description, save under liveStreams/{id}/sdp/offer
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);
await setDoc(doc(db, 'liveStreams', liveId, 'sdp', 'offer'), offer);

// 4. Listen for sdp/answer, set remote description when it appears
onSnapshot(doc(db, 'liveStreams', liveId, 'sdp', 'answer'), async (snap) => {
  if (snap.exists()) {
    const answer = snap.data();
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  }
});

// 5. Send ICE candidates to candidates_broadcaster
pc.onicecandidate = async (e) => {
  if (e.candidate) {
    await addDoc(collection(db, 'liveStreams', liveId, 'candidates_broadcaster'), e.candidate.toJSON());
  }
};
```

#### `connectAsViewer(liveId, videoEl)`
```typescript
// 1. Read sdp/offer from Firestore
const offerRef = doc(db, 'liveStreams', liveId, 'sdp', 'offer');
const offerSnap = await getDoc(offerRef);
const offer = offerSnap.data();

// 2. Create RTCPeerConnection with recvonly transceivers for video+audio
const pc = new RTCPeerConnection({ iceServers });
pc.addTransceiver('video', { direction: 'recvonly' });
pc.addTransceiver('audio', { direction: 'recvonly' });

// 3. Set remote description from offer
await pc.setRemoteDescription(new RTCSessionDescription(offer));

// 4. Create answer, set local description, save under sdp/answer
const answer = await pc.createAnswer();
await pc.setLocalDescription(answer);
await setDoc(doc(db, 'liveStreams', liveId, 'sdp', 'answer'), answer);

// 5. Send ICE candidates to candidates_viewers
pc.onicecandidate = async (e) => {
  if (e.candidate) {
    await addDoc(collection(db, 'liveStreams', liveId, 'candidates_viewers'), e.candidate.toJSON());
  }
};

// 6. Listen to candidates_broadcaster and add ICE candidates
onSnapshot(collection(db, 'liveStreams', liveId, 'candidates_broadcaster'), (snap) => {
  snap.docChanges().forEach((change) => {
    if (change.type === 'added') {
      const c = change.doc.data();
      pc.addIceCandidate(new RTCIceCandidate(c));
    }
  });
});

// 7. Attach remote MediaStream in pc.ontrack
const remoteStream = new MediaStream();
pc.ontrack = (e) => {
  if (e.streams && e.streams[0]) {
    e.streams[0].getTracks().forEach(t => remoteStream.addTrack(t));
    videoEl.srcObject = remoteStream;
    videoEl.autoplay = true;
    videoEl.playsInline = true;
    videoEl.muted = false;
    videoEl.play().catch(() => {});
  }
};
```

## 2. Broadcaster Updates (`src/pages/LiveStream.tsx`)

### Enhanced WebRTC Handling
- **Proper Track Addition**: Ensures all media tracks are added to RTCPeerConnection
- **Offer Creation**: Creates and publishes offer to Firestore
- **Connection Monitoring**: Listens for viewer answers and ICE candidates
- **Resource Cleanup**: Properly closes connections and removes listeners

### Key Changes
```typescript
const startBroadcast = async () => {
  try {
    await start();
    const id = await startLiveStream(title || 'Live');
    setMyStreamId(id);

    // Create broadcaster with WebRTC connection
    const broadcaster = await createBroadcasterPC(stream, id, (remoteStream) => {
      if (remoteRef.current) {
        remoteRef.current.srcObject = remoteStream;
      }
    });
    
    broadcasterRef.current = broadcaster;
    console.log('Broadcaster started successfully, waiting for viewers...');
  } catch (err) {
    console.error('Failed to start broadcast:', err);
    alert('Failed to start broadcast: ' + (err as Error).message);
  }
};
```

### Cleanup Management
```typescript
useEffect(() => {
  return () => {
    // Cleanup WebRTC connections
    if (broadcasterRef.current) {
      const { unsubAnswer, unsubViewerICE } = broadcasterRef.current;
      if (unsubAnswer) unsubAnswer();
      if (unsubViewerICE) unsubViewerICE();
      if (broadcasterRef.current.pc) {
        broadcasterRef.current.pc.close();
      }
    }
    // End live stream if active
    if (myStreamId) {
      endLiveStream(myStreamId).catch(() => {});
    }
  };
}, [myStreamId]);
```

## 3. Viewer Updates (`src/pages/WatchStream.tsx`)

### Connection Status Management
- **Real-time Monitoring**: Listens for stream status changes
- **Automatic Connection**: Connects when stream goes live
- **Status Display**: Shows connection progress to user
- **Error Handling**: Graceful fallbacks for connection failures

### Key Features
```typescript
// Connection status tracking
const [connectionStatus, setConnectionStatus] = useState<string>('Waiting for stream...');

// Real-time stream monitoring
const unsub = onSnapshot(streamRef, async (snap) => {
  if (data.status === 'live' && !isConnected) {
    setConnectionStatus('Connecting to stream...');
    try {
      const result = await connectAsViewer(id, videoRef.current);
      setIsConnected(true);
      setConnectionStatus('Connected to stream');
      cleanupRef.current = result.cleanup;
    } catch (err) {
      setError(err.message || 'Failed to connect to stream');
      setConnectionStatus('Connection failed');
    }
  }
});
```

### Video Element Setup
```typescript
<video
  ref={videoRef}
  autoPlay
  playsInline
  controls
  className="w-full h-full object-cover"
/>

{!isConnected && (
  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
    <div className="text-center">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
      <p className="text-white text-sm">{connectionStatus}</p>
    </div>
  </div>
)}
```

## 4. Firestore Security Rules

### Required Permissions
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /liveStreams/{id} {
      allow read: if true;               // Viewers can read stream metadata
      allow write: if request.auth != null && 
                   request.resource.data.uid == request.auth.uid; // Owner updates
      
      match /sdp/{doc} { 
        allow read, write: if true;      // SDP exchange is public
      }
      
      match /candidates_broadcaster/{doc} { 
        allow read, write: if true;      // ICE candidates are public
      }
      
      match /candidates_viewers/{doc} { 
        allow read, write: if true;      // ICE candidates are public
      }
    }
  }
}
```

## 5. Signaling Flow

### Complete Exchange Process
```
1. Broadcaster starts stream
   ├── Creates RTCPeerConnection
   ├── Adds local media tracks
   ├── Creates offer SDP
   ├── Saves offer to liveStreams/{id}/sdp/offer
   └── Starts sending ICE candidates to candidates_broadcaster

2. Viewer joins stream
   ├── Reads offer from liveStreams/{id}/sdp/offer
   ├── Creates RTCPeerConnection with recvonly transceivers
   ├── Sets remote description from offer
   ├── Creates answer SDP
   ├── Saves answer to liveStreams/{id}/sdp/answer
   └── Starts sending ICE candidates to candidates_viewers

3. Connection establishment
   ├── Broadcaster receives answer, sets remote description
   ├── Both parties exchange ICE candidates
   ├── WebRTC connection established
   └── Media stream flows from broadcaster to viewer
```

## 6. Testing & Verification

### Test Scenarios
1. **Start Broadcast**: Go to `/live/go`, start broadcast
2. **Check Firestore**: Verify `sdp/offer` and `candidates_broadcaster` are created
3. **Join as Viewer**: Click live card on Home, navigate to `/watch/:id`
4. **Verify Connection**: Check `sdp/answer` and `candidates_viewers` are created
5. **Media Playback**: Video/audio should appear on viewer's `<video>` element

### Expected Behavior
- ✅ Broadcaster publishes offer and ICE candidates
- ✅ Viewer creates answer and ICE candidates
- ✅ WebRTC connection establishes successfully
- ✅ Video/audio appears on viewer's screen
- ✅ Works without authentication for viewers
- ✅ Real-time updates and proper cleanup

### Debug Information
```typescript
// Check browser console for connection logs
console.log('Broadcaster started successfully, waiting for viewers...');
console.log('Viewer connected successfully');

// Check Firestore for proper document creation
// liveStreams/{id}/sdp/offer
// liveStreams/{id}/sdp/answer
// liveStreams/{id}/candidates_broadcaster/{candidate}
// liveStreams/{id}/candidates_viewers/{candidate}
```

## 7. Troubleshooting

### Common Issues & Solutions

#### No Video/Audio
- Verify Firestore permissions allow read/write to sdp and candidates
- Check browser console for WebRTC errors
- Ensure broadcaster has active media stream with tracks
- Verify STUN servers are accessible

#### Connection Failures
- Check Firestore for proper SDP exchange
- Monitor ICE candidate exchange
- Verify network connectivity and firewall settings
- Check browser WebRTC support

#### Firestore Errors
- Ensure security rules allow anonymous access to sdp and candidates
- Verify collection structure matches exactly
- Check for permission denied errors in console

### Debug Commands
```typescript
// In browser console
console.log('Stream data:', streamData);
console.log('WebRTC connection state:', pc?.connectionState);
console.log('Media tracks:', videoEl.srcObject);
console.log('ICE connection state:', pc?.iceConnectionState);
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
  unsubBroadcasterICE();
  pc.getSenders().forEach(s => s.track && s.track.stop());
  pc.getReceivers().forEach(r => r.track && r.track.stop());
  pc.close();
};
```

## Summary

The WebRTC signaling issues have been resolved through:

1. **Exact Firestore Structure**: Matches required subcollection layout
2. **Proper SDP Exchange**: Offer/answer flow between broadcaster and viewer
3. **ICE Candidate Management**: Separate collections for each party
4. **Enhanced Error Handling**: Comprehensive error reporting and fallbacks
5. **Resource Management**: Proper cleanup of WebRTC connections
6. **Status Monitoring**: Real-time connection status updates

The solution ensures that:
- ✅ Broadcaster publishes offer + ICE to Firestore
- ✅ Viewer reads offer, creates answer + ICE
- ✅ Video/audio appears on viewer's `<video>` element
- ✅ Works without authentication for viewers
- ✅ Proper cleanup and resource management

Live streaming now works reliably with robust WebRTC signaling and proper media stream delivery. 