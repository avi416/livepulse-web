// React default import not needed with the new JSX transform
import FeedList from '../components/feed/FeedList';

export default function Following() {
  return (
    <div className="pt-12 max-w-5xl mx-auto">
      <FeedList filterFollowed />
    </div>
  );
}
