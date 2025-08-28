export type Live = {
  id: string;
  userHandle: string;
  userName: string;
  title: string;
  viewers: number;
  tags: string[];
  thumbnail?: string;
  isLive: boolean;
  startedAt?: number;
  isFollowed?: boolean;
};
