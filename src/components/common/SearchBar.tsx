import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import '../../styles/components/SearchBar.css';

type Props = {
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
};

export default function SearchBar({ value: valueProp, onChange, onSubmit }: Props) {
  const [value, setValue] = useState<string>(valueProp ?? '');

  useEffect(() => {
    if (typeof valueProp === 'string') setValue(valueProp);
  }, [valueProp]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit?.(value.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="search-bar">
      <span className="search-bar__icon">
        <Search size={16} />
      </span>
      <input
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          onChange?.(e.target.value);
        }}
        className="search-bar__input"
        placeholder="Search"
        aria-label="Search"
      />
    </form>
  );
}
