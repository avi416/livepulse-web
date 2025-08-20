type Props = {
  photoURL?: string | null;
  displayName?: string | null;
  email?: string | null;
  size?: number;
  className?: string;
};

export default function UserAvatar({ photoURL, displayName, email, size = 36, className = '' }: Props) {
  const letter = (displayName ?? email ?? '')[0]?.toUpperCase() ?? '?';

  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={displayName ?? 'avatar'}
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center bg-slate-700 text-white rounded-full font-medium ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {letter}
    </div>
  );
}
