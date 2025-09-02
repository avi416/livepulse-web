import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getLiveOnlyStreams, type LiveStreamDoc } from '../services/streamService';

export default function LiveWatch() {
  const [streams, setStreams] = useState<LiveStreamDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    
    getLiveOnlyStreams()
      .then((s) => {
        if (mounted) {
          setStreams(s || []);
          setLoading(false);
        }
      })
      .catch((error) => {
        console.error("Error fetching streams:", error);
        if (mounted) {
          setStreams([]);
          setLoading(false);
        }
      });
      
    return () => { mounted = false; };
  }, []);

  return (
    <div className="pt-12 max-w-4xl mx-auto p-4">
      <div className="flex items-center mb-6">
        <h2 className="text-2xl font-semibold">Live Streams</h2>
        <div className="ml-3 flex items-center">
          <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse mr-2"></span>
          <span className="text-sm font-medium text-red-500">LIVE NOW</span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center p-8">
          <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-2"></div>
          <span className="text-blue-500">Loading streams...</span>
        </div>
      ) : (
        <div className="mt-4 grid gap-4">
          {streams.length === 0 ? (
            <div className="p-8 text-center bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-600 text-lg">No active streams right now.</p>
              <p className="mt-2 text-gray-500">Check back later or start your own stream!</p>
            </div>
          ) : (
            streams.map(s => (
              <Link 
                key={s.id} 
                to={`/watch/${s.id}`} 
                className="p-5 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 flex items-center"
              >
                <div className="flex-1">
                  <div className="font-bold text-lg text-gray-800">{s.title || 'Untitled stream'}</div>
                  <div className="text-sm text-gray-600 mt-1">Hosted by: {s.displayName || 'Unknown'}</div>
                  {s.cohosts && Object.keys(s.cohosts).length > 0 && (
                    <div className="mt-2 flex items-center">
                      <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full mr-2">
                        Co-hosts
                      </span>
                      <span className="text-xs text-gray-500">
                        {Object.keys(s.cohosts).length} active co-host{Object.keys(s.cohosts).length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end ml-4">
                  <span className="px-3 py-1 rounded-full bg-gradient-to-r from-red-600 to-red-500 text-white text-sm font-bold shadow-sm flex items-center">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse mr-2"></span>
                    LIVE
                  </span>
                  <span className="text-xs text-gray-500 mt-2">
                    {s.viewerCount || 0} {(s.viewerCount === 1) ? 'viewer' : 'viewers'}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
