import { useState } from 'react';

export function usePlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);

  function play() {
    setIsPlaying(true);
  }
  function pause() {
    setIsPlaying(false);
  }
  function setPlayerVolume(v: number) {
    setVolume(v);
  }

  return { isPlaying, volume, play, pause, setPlayerVolume };
}
