import React, { useRef, useState, useEffect } from 'react';
import { Volume2, VolumeX, Maximize, X } from 'lucide-react';
import YouTubePlayer from './YouTubePlayer';
import { Stream } from '../types';

interface StreamCardProps {
  stream: Stream;
  isAudioActive: boolean;
  onToggleAudio: (id: string) => void;
  onRemove: (id: string) => void;
  onLabelChange: (id: string, label: string) => void;
}

const StreamCard: React.FC<StreamCardProps> = ({
  stream,
  isAudioActive,
  onToggleAudio,
  onRemove,
  onLabelChange,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Toggle fullscreen on the wrapper div
  const handleToggleFullscreen = async (e?: React.MouseEvent) => {
    if(e) e.stopPropagation();
    if (!wrapperRef.current) return;

    if (!document.fullscreenElement) {
      try {
        await wrapperRef.current.requestFullscreen();
        setIsFullscreen(true);
      } catch (err) {
        console.error("Error attempting to enable full-screen mode:", err);
      }
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div
      ref={wrapperRef}
      className={`flex flex-col bg-zinc-900 rounded-xl shadow-lg border-2 transition-all duration-300 ${
        isAudioActive ? 'border-emerald-500/50 shadow-emerald-900/20' : 'border-zinc-800 hover:border-zinc-700'
      } ${isFullscreen ? 'w-full h-full' : ''}`}
    >
      <div className="flex items-center justify-between gap-3 p-4 border-b border-zinc-800 bg-zinc-950/70 rounded-t-xl">
        <div className="flex items-center gap-3 flex-1">
          <input
            type="text"
            value={stream.label ?? ''}
            onChange={(e) => onLabelChange(stream.id, e.target.value)}
            placeholder="Label this stream"
            className="w-full bg-zinc-900 border border-zinc-800 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500/50"
          />
          <span className={`text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded ${
            isAudioActive ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-300'
          }`}>
            {isAudioActive ? 'Audio on' : 'Muted'}
          </span>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onRemove(stream.id); }}
          className="p-2 rounded-full bg-rose-600/10 hover:bg-rose-600 text-rose-200 hover:text-white transition-colors border border-rose-600/30"
          title="Remove Stream"
        >
          <X size={16} />
        </button>
      </div>

      <div className="relative bg-black">
        <div className="relative w-full h-full aspect-video">
          <YouTubePlayer
            videoId={stream.videoId}
            isMuted={!isAudioActive}
            className="w-full h-full"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t border-zinc-800 bg-zinc-950/60 rounded-b-xl">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleAudio(stream.id); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            isAudioActive
              ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20'
              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
          }`}
        >
          {isAudioActive ? <Volume2 size={18} /> : <VolumeX size={18} />}
          <span>{isAudioActive ? 'Mute audio' : 'Enable audio'}</span>
        </button>

        <button
          onClick={handleToggleFullscreen}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 transition-colors"
          title="Fullscreen"
        >
          <Maximize size={18} />
          <span>{isFullscreen ? 'Exit expand' : 'Expand'}</span>
        </button>
      </div>
    </div>
  );
};

export default StreamCard;
