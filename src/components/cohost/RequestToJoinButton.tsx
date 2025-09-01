import { useState, useEffect } from 'react';
import { createOrUpdateJoinRequest, subscribeToCurrentUserRequest } from '../../services/streamService';
import { useAuth } from '../../contexts/AuthContext';
import type { JoinRequestDoc, JoinRequestStatus } from '../../types/cohost';

interface RequestToJoinButtonProps {
  liveId: string;
  status: string;
}

export default function RequestToJoinButton({ liveId, status }: RequestToJoinButtonProps) {
  const { user } = useAuth();
  const [requestStatus, setRequestStatus] = useState<JoinRequestStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user || status !== 'live') return;

    // Subscribe to the current user's request status
    const unsubscribe = subscribeToCurrentUserRequest(liveId, (request) => {
      if (request) {
        setRequestStatus(request.status as JoinRequestStatus);
      } else {
        setRequestStatus(null);
      }
    });

    return () => unsubscribe();
  }, [liveId, user, status]);

  const handleRequestToJoin = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      console.log(`🔷 Sending join request to liveId: ${liveId}`);
      await createOrUpdateJoinRequest(liveId, 'pending');
      console.log('✅ Request to join sent');
      
      // Force update status for testing
      setRequestStatus('pending');
    } catch (error) {
      console.error('❌ Failed to send join request:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      console.log(`🔷 Cancelling join request for liveId: ${liveId}`);
      await createOrUpdateJoinRequest(liveId, 'cancelled');
      console.log('✅ Request cancelled');
      
      // Force update status for testing
      setRequestStatus(null);
    } catch (error) {
      console.error('❌ Failed to cancel request:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Only show button for live streams and signed-in users
  if (status !== 'live' || !user) {
    return null;
  }

  // Return the appropriate button based on the request status
  if (requestStatus === 'pending') {
    return (
      <button
        onClick={handleCancelRequest}
        disabled={isLoading}
        className="px-3 py-1 bg-yellow-600 text-white rounded-md text-sm flex items-center"
      >
        {isLoading ? 'Cancelling...' : 'Cancel Request'}
      </button>
    );
  } else if (requestStatus === 'approved') {
    return (
      <div className="px-3 py-1 bg-green-600 text-white rounded-md text-sm flex items-center">
        Approved - Connecting...
      </div>
    );
  } else if (requestStatus === 'rejected') {
    return (
      <div className="px-3 py-1 bg-red-600 text-white rounded-md text-sm flex items-center">
        Request Rejected
      </div>
    );
  } else {
    // No request or cancelled request
    return (
      <button
        onClick={handleRequestToJoin}
        disabled={isLoading}
        className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm flex items-center"
      >
        {isLoading ? 'Sending...' : 'Request to Join'}
      </button>
    );
  }
}
