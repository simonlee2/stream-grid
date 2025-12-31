export interface Stream {
  id: string;
  url: string;
  videoId: string;
  addedAt: number;
  label?: string;
}

export interface PlayerControls {
  play: () => void;
  pause: () => void;
  mute: () => void;
  unMute: () => void;
  seekTo: (seconds: number) => void;
  getPlayerState: () => number;
}
