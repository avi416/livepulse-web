import Sidebar from './Sidebar';

export default function LeftNav() {
  return (
    <aside className="h-[calc(100vh-4rem)] sticky top-14 overflow-auto pr-2">
      <div className="p-3">
        <Sidebar />
      </div>
    </aside>
  );
}
