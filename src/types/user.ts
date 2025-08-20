export type User = {
  uid?: string;
  handle: string;
  name: string;
  avatarUrl?: string;
  role?: 'user' | 'admin';
};
