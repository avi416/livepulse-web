import { 
  collection, 
  addDoc, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  serverTimestamp, 
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  limit,
  writeBatch
} from 'firebase/firestore';
import { getFirestoreInstance } from './firebase';
import { getAuth } from 'firebase/auth';

export type LiveStreamStatus = 'live' | 'ended';

export interface Stream {
  id: string;
  title: string;
  description?: string;
  createdAt: number;
  isLive: boolean;
  userId: string | null;
}

export interface LiveStreamDoc {
  id: string;
  title: string;
  status: LiveStreamStatus;
  startedAt: unknown;
  endedAt?: unknown;
  lastSeen?: unknown;
  uid?: string | null;
  userId?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}

/**
 * 📺 יצירת שידור חי חדש בפיירסטור
 */
export async function startLiveStream(title: string): Promise<string> {
  const db = getFirestoreInstance();
  const liveId = `stream_${Date.now()}`;
  const ref = doc(db, 'liveStreams', liveId);

  // נביא את המשתמש הנוכחי מ־Auth
  const auth = getAuth();
  const user = auth.currentUser;

  // End any previous live sessions for this user (cleanup duplicates)
  if (user?.uid) {
    try {
      const q1 = query(collection(db, 'liveStreams'), where('status', '==', 'live'), where('uid', '==', user.uid));
      const q2 = query(collection(db, 'liveStreams'), where('status', '==', 'live'), where('userId', '==', user.uid));
      const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      const toEnd = new Map<string, any>();
      s1.forEach((d: any) => toEnd.set(d.id, d));
      s2.forEach((d: any) => toEnd.set(d.id, d));
      await Promise.all(Array.from(toEnd.values()).map(async (d: any) => {
        try { await updateDoc(doc(db, 'liveStreams', d.id), { status: 'ended', endedAt: serverTimestamp() }); } catch {}
      }));
    } catch (e) {
      console.warn('⚠️ Failed to end previous lives for user:', e);
    }
  }

  await setDoc(ref, {
    id: liveId,
    title,
    status: 'live',
    startedAt: serverTimestamp(),
  lastSeen: serverTimestamp(),
    uid: user ? user.uid : null,
    userId: user ? user.uid : null,
    displayName: user?.displayName || 'Anonymous',
    photoURL: user?.photoURL || null,
  });

  return liveId;
}

/**
 * 🛑 סיום שידור חי
 */
export async function endLiveStream(id: string): Promise<void> {
  const db = getFirestoreInstance();
  await updateDoc(doc(db, 'liveStreams', id), {
    status: 'ended',
    endedAt: serverTimestamp(),
  });
}

/**
 * 📡 החזרת כל השידורים החיים
 */
export async function getLiveStreams(): Promise<LiveStreamDoc[]> {
  const db = getFirestoreInstance();
  const snap = await getDocs(collection(db, 'liveStreams'));
  return snap.docs.map((d: any) => d.data() as LiveStreamDoc);
}

/**
 * 🎯 Fetch only currently live streams (status == 'live'), newest first
 */
export async function getLiveOnlyStreams(): Promise<LiveStreamDoc[]> {
  const db = getFirestoreInstance();
  console.log("📊 Fetching live streams...");
  
  const q = query(
    collection(db, 'liveStreams'),
    where('status', '==', 'live'),
    orderBy('startedAt', 'desc')
  );
  
  const snap = await getDocs(q);
  console.log(`📊 Found ${snap.docs.length} live streams in database`);
  
  const items = snap.docs.map((d: any) => {
    const data = d.data() as any;
    return { ...data, id: d.id } as LiveStreamDoc;
  });
  
  // Client-side freshness filter using lastSeen (<= 5min old)
  const now = Date.now();
  const fresh = items.filter((it: any) => {
    const ts: any = it.lastSeen || it.startedAt;
    try {
      const ms = typeof ts?.toMillis === 'function' ? ts.toMillis() : (typeof ts === 'number' ? ts : 0);
      // Increased timeout to 5 minutes (300,000ms) to prevent streams from disappearing too quickly
      const isFresh = ms && now - ms <= 300_000;
      if (!isFresh) {
        console.log(`⚠️ Stream ${it.id} filtered out due to staleness: Last seen ${new Date(ms).toISOString()}`);
      }
      return isFresh;
    } catch (err) {
      console.error(`❌ Error checking freshness for stream ${it.id}:`, err);
      return false;
    }
  });
  
  console.log(`📊 Returning ${fresh.length} fresh live streams`);
  return fresh as LiveStreamDoc[];
}

/**
 * 📡 Subscribe to live streams in real-time
 * @param callback Function to call when live streams update
 * @returns Unsubscribe function
 */
export function subscribeLiveStreams(callback: (streams: LiveStreamDoc[]) => void): () => void {
  const db = getFirestoreInstance();
  console.log("🔔 Setting up live streams subscription");
  
  const q = query(
    collection(db, 'liveStreams'),
    where('status', '==', 'live'),
    orderBy('startedAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot: any) => {
    console.log(`📊 Real-time update: Received ${snapshot.docs.length} live streams`);
    
    const items = snapshot.docs.map((d: any) => {
      const data = d.data() as any;
      return { ...data, id: d.id } as LiveStreamDoc;
    });
    
    // Client-side freshness filter using lastSeen (<= 5min old)
    const now = Date.now();
    const fresh = items.filter((it: any) => {
      const ts: any = it.lastSeen || it.startedAt;
      try {
        const ms = typeof ts?.toMillis === 'function' ? ts.toMillis() : (typeof ts === 'number' ? ts : 0);
        // Increased timeout to 5 minutes (300,000ms) to prevent streams from disappearing too quickly
        const isFresh = ms && now - ms <= 300_000;
        if (!isFresh) {
          console.log(`⚠️ Stream ${it.id} filtered out due to staleness: Last seen ${new Date(ms).toISOString()}`);
        }
        return isFresh;
      } catch (err) {
        console.error(`❌ Error checking freshness for stream ${it.id}:`, err);
        return false;
      }
    });
    
    console.log(`📊 Delivering ${fresh.length} fresh live streams to UI`);
    callback(fresh as LiveStreamDoc[]);
  }, (error: any) => {
    console.error("❌ Error subscribing to live streams:", error);
    callback([]);
  });
}

/**
 * 🔄 Heartbeat: update lastSeen to keep stream considered "live".
 * Also verifies the stream is still in 'live' status before updating.
 */
export async function heartbeatLiveStream(id: string): Promise<void> {
  const db = getFirestoreInstance();
  
  // First check if the stream is still in 'live' status
  const streamRef = doc(db, 'liveStreams', id);
  const streamDoc = await getDoc(streamRef);
  
  if (!streamDoc.exists()) {
    console.warn(`⚠️ Heartbeat failed: Stream ${id} does not exist`);
    return;
  }
  
  const streamData = streamDoc.data();
  if (streamData.status !== 'live') {
    console.warn(`⚠️ Heartbeat skipped: Stream ${id} is not live (status: ${streamData.status})`);
    return;
  }
  
  // Update the lastSeen timestamp
  console.log(`💓 Updating heartbeat for stream ${id}`);
  await updateDoc(streamRef, { 
    lastSeen: serverTimestamp(),
    // Ensure status is still 'live'
    status: 'live'
  });
  console.log(`✅ Heartbeat updated for stream ${id}`);
}

/**
 * 📝 יצירת מטא-דאטה לשידור (במידה ורוצים גם טבלת streams כללית)
 */
export async function createStreamMetadata(stream: Omit<Stream, 'id'>) {
  const db = getFirestoreInstance();
  const col = collection(db, 'streams');
  const ref = await addDoc(col, stream as any);
  await setDoc(doc(db, 'streams', ref.id), { ...stream, id: ref.id });
  return ref.id;
}

/**
 * 🎯 החזרת שידור לפי מזהה
 */
export async function getStreamById(id: string) {
  const db = getFirestoreInstance();
  const docRef = doc(db, 'liveStreams', id);
  const snap = await getDoc(docRef);
  return snap.exists() ? (snap.data() as LiveStreamDoc) : null;
}

/**
 * Create or update a co-host request for a live stream
 * @param liveId The ID of the live stream
 * @param status The status of the request
 * @returns Promise void
 */
export async function createOrUpdateJoinRequest(liveId: string, status: 'pending' | 'cancelled') {
  const db = getFirestoreInstance();
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) {
    throw new Error('User must be signed in to request co-host');
  }
  
  const requestRef = doc(db, 'liveStreams', liveId, 'requests', user.uid);
  
  await setDoc(requestRef, {
    uid: user.uid,
    displayName: user.displayName,
    photoURL: user.photoURL,
    status,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

/**
 * Update a co-host request status (host only)
 * @param liveId The ID of the live stream
 * @param viewerUid The UID of the viewer who made the request
 * @param status The new status to set (approved or rejected)
 * @returns Promise void
 */
export async function updateJoinRequestStatus(
  liveId: string,
  viewerUid: string,
  status: 'approved' | 'rejected'
) {
  const db = getFirestoreInstance();
  
  // Optional: If only allowing one approved co-host at a time,
  // reject any previously approved requests
  if (status === 'approved') {
    try {
      const q = query(
        collection(db, 'liveStreams', liveId, 'requests'),
        where('status', '==', 'approved')
      );
      
      const snap = await getDocs(q);
      // Use writeBatch instead of db.batch()
      const batch = writeBatch(db);
      
      snap.docs.forEach((docSnapshot: any) => {
        if (docSnapshot.id !== viewerUid) { // Don't update the current request in this batch
          const docRef = doc(db, 'liveStreams', liveId, 'requests', docSnapshot.id);
          batch.update(docRef, { 
            status: 'rejected',
            updatedAt: serverTimestamp()
          });
        }
      });
      
      console.log(`💡 Committing batch update to reject ${snap.docs.length - 1} previous approvals`);
      await batch.commit();
    } catch (err) {
      console.error('Failed to reject previous approved requests:', err);
      // Continue with current approval regardless
    }
  }
  
  // Update the target request status
  const requestRef = doc(db, 'liveStreams', liveId, 'requests', viewerUid);
  await updateDoc(requestRef, {
    status,
    updatedAt: serverTimestamp()
  });
}

/**
 * Subscribe to join requests for a live stream (host only)
 * @param liveId The ID of the live stream
 * @param callback Function to call with updated requests
 * @returns Unsubscribe function
 */
export function subscribeToRequests(liveId: string, callback: (requests: any[]) => void) {
  const db = getFirestoreInstance();
  const requestsRef = collection(db, 'liveStreams', liveId, 'requests');
  const q = query(requestsRef, orderBy('createdAt', 'desc'));
  
  console.log(`🔔 Subscribing to requests for live stream: ${liveId}`);
  
  return onSnapshot(q, (snapshot: any) => {
    const requests = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    }));
    console.log(`📊 Received ${requests.length} requests:`, requests);
    callback(requests);
  }, (error: any) => {
    console.error('❌ Error subscribing to requests:', error);
    callback([]);
  });
}

/**
 * Get a single join request for the current user
 * @param liveId The ID of the live stream
 * @returns Promise with the request data or null if not found
 */
export async function getCurrentUserJoinRequest(liveId: string) {
  const db = getFirestoreInstance();
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) return null;
  
  const requestRef = doc(db, 'liveStreams', liveId, 'requests', user.uid);
  const snap = await getDoc(requestRef);
  
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Subscribe to the current user's join request status
 * @param liveId The ID of the live stream
 * @param callback Function to call with updated request
 * @returns Unsubscribe function or null if not signed in
 */
export function subscribeToCurrentUserRequest(liveId: string, callback: (request: any | null) => void) {
  const db = getFirestoreInstance();
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) {
    callback(null);
    return () => {};
  }
  
  const requestRef = doc(db, 'liveStreams', liveId, 'requests', user.uid);
  
  return onSnapshot(requestRef, (snapshot: any) => {
    if (snapshot.exists()) {
      callback({ id: snapshot.id, ...snapshot.data() });
    } else {
      callback(null);
    }
  }, (error: any) => {
    console.error('Error subscribing to user request:', error);
    callback(null);
  });
}
