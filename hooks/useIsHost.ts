import { useMemo } from 'react';
import type { LiveStreamDoc } from '../services/streamService';
import { computeIsHost } from '../utils/isHost';

export function useIsHost(
  doc: LiveStreamDoc | null | undefined,
  authUid: string | null | undefined,
  localOverride?: boolean
): boolean {
  const snapshotIsHost = useMemo(
    () => computeIsHost(doc, authUid),
    [doc?.userId, (doc as any)?.uid, authUid]
  );
  return !!(localOverride || snapshotIsHost);
}
