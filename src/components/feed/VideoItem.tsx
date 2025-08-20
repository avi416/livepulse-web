import React from 'react';

export default function VideoItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto aspect-[9/16] w-full max-w-[600px] rounded-2xl overflow-hidden shadow-lg bg-black">
      {children}
    </div>
  );
}
