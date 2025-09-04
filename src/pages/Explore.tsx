import SearchBar from '../components/common/SearchBar';
import '../styles/pages/Explore.css';

const tags = ['music', 'gaming', 'chat', 'cooking', 'art', 'fitness', 'tech', 'travel'];

export default function Explore() {
  return (
    <div className="explore">
      <div className="explore__search">
        <SearchBar />
      </div>
      <div className="explore__tags">
        {tags.map(tag => (
          <div key={tag} className="explore__tag">#{tag}</div>
        ))}
      </div>
    </div>
  );
}
