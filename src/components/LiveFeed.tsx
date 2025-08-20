import LiveCard from "./LiveCard.tsx";

type Live = {
  id: number;
  thumbnail: string;
  title: string;
  streamer: string;
};

const demoLives: Live[] = [
  {
    id: 1,
    thumbnail: "https://placehold.co/300x200?text=Live+1",
    title: "Gaming with Avi",
    streamer: "AviGamer",
  },
  {
    id: 2,
    thumbnail: "https://placehold.co/300x200?text=Live+2",
    title: "Chill Music Stream",
    streamer: "LoFiBeats",
  },
  {
    id: 3,
    thumbnail: "https://placehold.co/300x200?text=Live+3",
    title: "Cooking Live",
    streamer: "ChefDan",
  },
];

export default function LiveFeed() {
  return (
    <div className="flex flex-wrap justify-center gap-6 p-6 bg-gray-100 min-h-screen">
      {demoLives.map((live) => (
        <LiveCard key={live.id} {...live} />
      ))}
    </div>
  );
}
