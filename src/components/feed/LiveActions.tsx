import '../../styles/components/LiveActions.css';

type Props = { compact?: boolean };

export default function LiveActions({ compact }: Props) {
  return (
    <div className={compact ? 'actions compact' : 'actions'} role="toolbar" aria-label="live actions">
      <button aria-label="like">❤</button>
      <button aria-label="comment">💬</button>
      <button aria-label="share">↗</button>
    </div>
  );
}
