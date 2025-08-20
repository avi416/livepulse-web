export type User = {
  uid?: string;
  handle: string;
  name: string;
  avatarUrl?: string;
  role?: 'user' | 'admin';
  email?: string;
  createdAt?: number | { seconds?: number };
};
