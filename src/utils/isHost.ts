import type { LiveStreamDoc } from "../services/streamService";

export function computeIsHost(doc: LiveStreamDoc | null | undefined, authUid: string | null | undefined): boolean {
  if (!doc || !authUid) return false;
  // Canonical: doc.userId; fall back to legacy doc.uid if present
  const owner: string | null = (doc as any).userId ?? (doc as any).uid ?? null;
  return !!(owner && owner === authUid);
}

