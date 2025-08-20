import React from 'react';
import FeedList from '../components/feed/FeedList';

export default function Following() {
  return (
    <div className="pt-12 max-w-5xl mx-auto">
      <FeedList filterFollowed />
    </div>
  );
}
