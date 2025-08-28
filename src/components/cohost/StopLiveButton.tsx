import '../../styles/cohost.css';

type Props = {
  onStop: () => void | Promise<void>;
};

export default function StopLiveButton({ onStop }: Props) {
  const handle = async () => {
    const ok = window.confirm('Are you sure you want to stop the live?');
    if (!ok) return;
    await onStop();
  };
  return (
    <button className="btn-stop" onClick={handle}>Stop Live</button>
  );
}
