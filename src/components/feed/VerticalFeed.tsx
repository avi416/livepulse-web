import React from 'react';
import FeedList from './FeedList';

export default function VerticalFeed() {
  return (
    <div className="flex justify-center">
      <div className="w-full max-w-[600px]">
        <FeedList />
      </div>
    </div>
  );
}
