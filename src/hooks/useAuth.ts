import { useState } from 'react';
import type { User } from '../types/user';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  // Dummy login/logout for demo
  function login(username: string) {
    setLoading(true);
    setTimeout(() => {
      setUser({ id: '1', username, avatarUrl: '' });
      setLoading(false);
    }, 500);
  }

  function logout() {
    setUser(null);
  }

  return { user, loading, login, logout };
}
