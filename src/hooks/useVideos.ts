import { useState, useEffect } from "react";

export function useVideos() {
  const [videos, setVideos] = useState<any[]>([]);

  useEffect(() => {
    // אפשר להביא פה מ־Firebase או API
    setVideos([
      { id: 1, src: "/videos/video1.mp4", user: "Avi", likes: 120 },
      { id: 2, src: "/videos/video2.mp4", user: "Dana", likes: 340 },
    ]);
  }, []);

  return { videos, setVideos };
}
