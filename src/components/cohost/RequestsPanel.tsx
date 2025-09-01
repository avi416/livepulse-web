import { useState, useEffect } from 'react';
import { subscribeToRequests, updateJoinRequestStatus } from '../../services/streamService';
import type { JoinRequestDoc, JoinRequestStatus } from '../../types/cohost';

interface RequestsPanelProps {
  liveId: string;
  onApproved?: (uid: string) => void;
}

interface RequestWithId extends JoinRequestDoc {
  id: string;
}

export default function RequestsPanel({ liveId, onApproved }: RequestsPanelProps) {
  const [requests, setRequests] = useState<RequestWithId[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  useEffect(() => {
    // Subscribe to join requests
    const unsubscribe = subscribeToRequests(liveId, (requestsData) => {
      setRequests(requestsData as RequestWithId[]);
    });

    return () => unsubscribe();
  }, [liveId]);

  const handleApprove = async (viewerUid: string) => {
    setActionInProgress(viewerUid);
    setLoading(true);
    try {
      await updateJoinRequestStatus(liveId, viewerUid, 'approved');
      console.log('✅ Request approved');
      onApproved?.(viewerUid);
    } catch (error) {
      console.error('❌ Failed to approve request:', error);
    } finally {
      setLoading(false);
      setActionInProgress(null);
    }
  };

  const handleReject = async (viewerUid: string) => {
    setActionInProgress(viewerUid);
    setLoading(true);
    try {
      await updateJoinRequestStatus(liveId, viewerUid, 'rejected');
      console.log('✅ Request rejected');
    } catch (error) {
      console.error('❌ Failed to reject request:', error);
    } finally {
      setLoading(false);
      setActionInProgress(null);
    }
  };

  // Filter requests for UI display
  const pendingRequests = requests.filter(req => req.status === 'pending');
  const approvedRequests = requests.filter(req => req.status === 'approved');

  // For debugging - log requests to console
  useEffect(() => {
    console.log("🔍 RequestsPanel - liveId:", liveId);
    console.log("🔍 RequestsPanel - requests count:", requests.length);
    console.log("🔍 RequestsPanel - all requests:", requests);
    console.log("🔍 RequestsPanel - pending requests:", pendingRequests);
  }, [requests, pendingRequests, liveId]);

  if (requests.length === 0) {
    return (
      <div className="mb-6 p-5 bg-white rounded-md border-2 border-blue-200 shadow-md">
        <h3 className="text-xl font-bold text-gray-800 flex items-center">
          <span className="text-blue-500 mr-2">👥</span> Co-host Requests
        </h3>
        <p className="text-gray-700 mt-3 p-3 bg-gray-50 rounded-md border border-gray-200">No requests to join yet.</p>
      </div>
    );
  }

  return (
    <div className="mb-6 p-5 bg-white rounded-md border-2 border-blue-200 shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-800 flex items-center">
          <span className="text-blue-500 mr-2">👥</span> Co-host Requests
        </h3>
        {loading && (
          <div className="flex items-center">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-2"></div>
            <span className="text-blue-500">Processing...</span>
          </div>
        )}
      </div>
      
      {pendingRequests.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center mb-3">
            <h4 className="text-lg font-bold text-gray-800">Pending Requests</h4>
            <span className="ml-2 px-3 py-1 bg-yellow-400 text-gray-800 text-sm font-bold rounded-full shadow-md animate-pulse">
              {pendingRequests.length}
            </span>
          </div>
          <div className="space-y-4 mt-3">
            {pendingRequests.map((request) => (
              <div key={request.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 border-2 border-yellow-200 rounded-lg shadow-md">
                <div className="flex items-center">
                  {request.photoURL ? (
                    <img 
                      src={request.photoURL} 
                      alt={request.displayName || 'User'} 
                      className="w-12 h-12 rounded-full mr-3 border-2 border-yellow-300 shadow-md"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full mr-3 bg-yellow-300 flex items-center justify-center text-gray-800 font-bold border-2 border-yellow-200">
                      {(request.displayName || 'A').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <span className="font-bold text-gray-800 text-lg">{request.displayName || 'Anonymous'}</span>
                    <div className="text-yellow-700 text-sm">Wants to join your stream</div>
                  </div>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => handleApprove(request.id)}
                    disabled={loading || actionInProgress === request.id}
                    className="px-4 py-2 bg-gradient-to-r from-green-400 to-green-500 text-white rounded-md text-sm font-bold shadow-md hover:from-green-500 hover:to-green-600 transition-all transform hover:scale-105 flex items-center"
                  >
                    <span className="mr-1">✓</span> Approve
                  </button>
                  <button
                    onClick={() => handleReject(request.id)}
                    disabled={loading || actionInProgress === request.id}
                    className="px-4 py-2 bg-gradient-to-r from-red-400 to-red-500 text-white rounded-md text-sm font-bold shadow-md hover:from-red-500 hover:to-red-600 transition-all transform hover:scale-105 flex items-center"
                  >
                    <span className="mr-1">✕</span> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {approvedRequests.length > 0 && (
        <div className="mt-6 pt-4 border-t-2 border-gray-200">
          <div className="flex items-center mb-3">
            <h4 className="text-lg font-bold text-gray-800">Approved Co-hosts</h4>
            <span className="ml-2 px-3 py-1 bg-green-400 text-gray-800 text-sm font-bold rounded-full shadow-md">
              {approvedRequests.length}
            </span>
          </div>
          <div className="space-y-4 mt-3">
            {approvedRequests.map((request) => (
              <div key={request.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-200 rounded-lg shadow-md">
                <div className="flex items-center">
                  {request.photoURL ? (
                    <img 
                      src={request.photoURL} 
                      alt={request.displayName || 'User'} 
                      className="w-12 h-12 rounded-full mr-3 border-2 border-green-300 shadow-md"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full mr-3 bg-green-300 flex items-center justify-center text-gray-800 font-bold border-2 border-green-200">
                      {(request.displayName || 'A').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <span className="font-bold text-gray-800 text-lg">{request.displayName || 'Anonymous'}</span>
                    <div className="text-green-700 text-sm flex items-center">
                      <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                      Currently co-hosting
                    </div>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleReject(request.id)}
                    disabled={loading || actionInProgress === request.id}
                    className="px-4 py-2 bg-gradient-to-r from-red-400 to-red-500 text-white rounded-md text-sm font-bold shadow-md hover:from-red-500 hover:to-red-600 transition-all transform hover:scale-105 flex items-center"
                  >
                    <span className="mr-1">✕</span> Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
