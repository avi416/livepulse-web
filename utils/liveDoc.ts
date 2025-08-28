import type { LiveStreamDoc as LiveDocStreamService } from "../services/streamService";
import type { LiveStreamDoc as LiveDocAlt } from "../services/liveStreams";

type AnyLiveDoc = (LiveDocStreamService | LiveDocAlt | (Record<string, unknown> & { id: string })) & {
  userId?: string | null;
  uid?: string | null;
};

export function normalizeLiveDoc<T extends AnyLiveDoc>(doc: T): T & { userId: string | null } {
  const userId = (doc.userId ?? doc.uid ?? null) as string | null;
  return { ...(doc as any), userId } as T & { userId: string | null };
}
