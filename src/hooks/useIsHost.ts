import type { LiveStreamDoc } from '../services/streamService';
import { useAuth } from '../contexts/AuthContext';

/**
 * Helper hook to determine if the current user is the host of a live stream
 * @param liveDoc The live stream document to check against
 * @returns boolean indicating if current user is the host
 */
export function useIsHost(liveDoc: LiveStreamDoc | null): boolean {
  const { user } = useAuth();
  
  if (!user || !liveDoc) return false;
  
  // Check if current user ID matches either the userId or uid field in the live doc
  return user.uid === liveDoc.userId || user.uid === liveDoc.uid;
}
