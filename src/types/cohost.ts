export type JoinRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface JoinRequestDoc {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  status: JoinRequestStatus;
  createdAt: any; // Firestore timestamp
  updatedAt: any; // Firestore timestamp
}

export interface CoHostConnection {
  uid: string;
  displayName?: string | null;
  photoURL?: string | null;
  peerConnection: RTCPeerConnection;
  stream?: MediaStream;
  isMuted: boolean;
}
