import { useMemo } from 'react';
import type { User } from '../types/user';

export function useUser() {
  const user = useMemo<User>(() => ({ handle: 'me', name: 'Me', avatarUrl: undefined }), []);
  return { user };
}
