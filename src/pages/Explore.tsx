// React default import not needed with the new JSX transform
import SearchBar from '../components/common/SearchBar';

const tags = ['music','gaming','chat','cooking','art','fitness','tech','travel'];

export default function Explore() {
  return (
    <div className="pt-12 max-w-5xl mx-auto p-4">
      <div className="mb-4"><SearchBar /></div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {tags.map(t => (
          <div key={t} className="p-6 bg-gray-800 rounded text-center">#{t}</div>
        ))}
      </div>
    </div>
  );
}
