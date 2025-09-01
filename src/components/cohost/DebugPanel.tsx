import { useState } from 'react';
import type { CoHostConnection } from '../../types/cohost';

interface DebugPanelProps {
  isVisible: boolean;
  cohosts: CoHostConnection[];
  streamId: string | null;
}

/**
 * Debug panel to help troubleshoot co-host connection issues
 */
export default function DebugPanel({ isVisible, cohosts, streamId }: DebugPanelProps) {
  const [expanded, setExpanded] = useState(false);
  
  if (!isVisible) return null;
  
  return (
    <div className="mt-4 p-3 bg-black text-green-400 rounded-md shadow-md font-mono text-xs">
      <div className="flex justify-between items-center cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <h4 className="font-bold">🛠️ Debug Panel {expanded ? '▼' : '▶'}</h4>
        <span>{cohosts.length} co-hosts</span>
      </div>
      
      {expanded && (
        <div className="mt-2 space-y-2">
          <div>
            <strong>Stream ID:</strong> {streamId || 'none'}
          </div>
          
          <div>
            <strong>Co-hosts:</strong>
            {cohosts.length === 0 && <div className="pl-2 mt-1">None</div>}
            
            {cohosts.map((ch, idx) => (
              <div key={ch.uid} className="pl-2 mt-1 border-l-2 border-green-800">
                <div><strong>#{idx+1} UID:</strong> {ch.uid}</div>
                <div><strong>Has Stream:</strong> {ch.stream ? 'Yes' : 'No'}</div>
                {ch.stream && (
                  <>
                    <div><strong>Tracks:</strong> {ch.stream.getTracks().length}</div>
                    <div className="pl-2">
                      {ch.stream.getTracks().map((t, i) => (
                        <div key={i} className="text-green-200">
                          {t.kind}: {t.enabled ? 'enabled' : 'disabled'}, {t.muted ? 'muted' : 'unmuted'}
                        </div>
                      ))}
                    </div>
                    <div><strong>Muted:</strong> {ch.isMuted ? 'Yes' : 'No'}</div>
                  </>
                )}
              </div>
            ))}
          </div>
          
          <div className="text-yellow-300 mt-2">
            If co-host video is not visible, try refreshing the page
          </div>
        </div>
      )}
    </div>
  );
}
