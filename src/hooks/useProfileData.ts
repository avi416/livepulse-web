import { useEffect, useState } from 'react';
import type { User } from '../types/user';

export function useProfileData(handle: string) {
  const [data, setData] = useState<User | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      setData({ handle, name: handle.replace('@',''), avatarUrl: undefined });
    }, 200);
    return () => clearTimeout(t);
  }, [handle]);
  return { data, loading: data === null };
}
