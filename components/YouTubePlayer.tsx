import React, { useEffect, useRef, useMemo, useState } from 'react';

interface YouTubePlayerProps {
  videoId: string;
  isMuted: boolean;
  className?: string;
}

const YouTubePlayer: React.FC<YouTubePlayerProps> = ({ videoId, isMuted, className }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  // Memoize origin to ensure stability and match the current environment (e.g., localhost)
  const origin = useMemo(() => {
    if (typeof window !== 'undefined') {
        return window.location.origin;
    }
    return '';
  }, []);

  const iframeId = useMemo(
    () => `yt-player-${videoId}-${Math.random().toString(36).slice(2, 9)}`,
    [videoId]
  );

  // Listen for YouTube ready events so we only send commands when the iframe API is ready
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://www.youtube.com') return;
      if (typeof event.data !== 'string') return;
      try {
        const payload = JSON.parse(event.data);
        if (payload?.event === 'onReady' && payload?.id === iframeId) {
          setIsPlayerReady(true);
        }
      } catch {
        // Ignore malformed messages that aren't JSON
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [iframeId]);

  // Proactively ping the iframe so it starts sending events back
  useEffect(() => {
    if (!iframeRef.current?.contentWindow || isPlayerReady) return;

    const ping = () => {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'listening', id: iframeId }),
        'https://www.youtube.com'
      );
    };

    const interval = window.setInterval(ping, 300);
    // Fire an initial ping without waiting for the first interval tick
    ping();

    return () => window.clearInterval(interval);
  }, [iframeId, isPlayerReady]);

  // Handle Mute/Unmute via postMessage commands once the player is ready
  useEffect(() => {
    if (!iframeRef.current?.contentWindow || !isPlayerReady) return;
    const action = isMuted ? 'mute' : 'unMute';
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify({ event: 'command', func: action, args: [], id: iframeId }),
      'https://www.youtube.com'
    );
  }, [isMuted, iframeId, isPlayerReady]);

  // Use youtube.com/embed with enablejsapi=1 and origin
  // enablejsapi=1 is required for postMessage control
  // origin is required by YouTube to allow the JS API to function securely
  const src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=1&playsinline=1&rel=0&enablejsapi=1&origin=${origin}`;

  return (
    <div className={`relative w-full h-full bg-black ${className}`}>
      <iframe
        ref={iframeRef}
        id={iframeId}
        src={src}
        className="w-full h-full absolute inset-0"
        title={`YouTube video player ${videoId}`}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
};

export default YouTubePlayer;
