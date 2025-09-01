import type { ReactNode } from 'react';
import { Heart, MessageSquare, Share2, Bookmark } from 'lucide-react';

type ActionProps = { icon: ReactNode; label: string; count?: number };

function Action({ icon, label, count }: ActionProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button aria-label={label} className="w-12 h-12 rounded-full bg-[var(--panel)] flex items-center justify-center shadow-md">
        {icon}
      </button>
      {typeof count === 'number' && <span className="text-sm text-[var(--muted)]">{count}</span>}
    </div>
  );
}

export default function ActionRail() {
  return (
    <div className="p-3 sticky top-40 flex flex-col items-center gap-4">
      <Action icon={<Heart className="w-5 h-5 text-[var(--primary)]" />} label="Like" count={124} />
      <Action icon={<MessageSquare className="w-5 h-5 text-[var(--primary)]" />} label="Comment" count={32} />
      <Action icon={<Share2 className="w-5 h-5 text-[var(--primary)]" />} label="Share" />
      <Action icon={<Bookmark className="w-5 h-5 text-[var(--primary)]" />} label="Save" />
    </div>
  );
}
