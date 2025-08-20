import { useEffect, useState } from 'react';
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
    <form onSubmit={handleSubmit} className="search">
      <input
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          onChange?.(e.target.value);
        }}
        className="w-full px-3 py-2 rounded-full bg-transparent text-inherit placeholder:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)]"
        placeholder="Search"
        aria-label="Search"
      />
    </form>
  );
}
