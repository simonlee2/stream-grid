import React, { useState, useEffect, useRef } from 'react';
import { Plus, LayoutGrid, AlertCircle, Youtube, Tv } from 'lucide-react';
import { Stream } from './types';
import { getYouTubeVideoId, generateId } from './utils';
import StreamCard from './components/StreamCard';
import { decompressFromEncodedURIComponent } from 'lz-string';

interface EncodedStream {
  v: string; // videoId
  l?: string; // label
}

interface EncodedState {
  s: EncodedStream[];
  a?: string; // active audio videoId
}

const hydrateStreamsFromEntries = (entries: EncodedStream[]): Stream[] => {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter(entry => entry?.v)
    .map((entry, index) => ({
      id: generateId(),
      url: `https://www.youtube.com/watch?v=${entry.v}`,
      videoId: entry.v,
      addedAt: Date.now() + index,
      label: entry.l || `Stream ${index + 1}`,
    }));
};

const hydrateStreamsFromIds = (ids: string[]): Stream[] => {
  if (!Array.isArray(ids)) return [];
  return ids
    .filter(Boolean)
    .map((videoId, index) => ({
      id: generateId(),
      url: `https://www.youtube.com/watch?v=${videoId}`,
      videoId,
      addedAt: Date.now() + index,
      label: `Stream ${index + 1}`,
    }));
};

const parseCompressedState = (value: string | null): EncodedState | null => {
  if (!value) return null;
  try {
    const decompressed = decompressFromEncodedURIComponent(value);
    if (!decompressed) return null;
    const parsed = JSON.parse(decompressed);
    if (parsed && Array.isArray(parsed.s)) {
      return {
        s: parsed.s,
        a: typeof parsed.a === 'string' ? parsed.a : undefined,
      };
    }
  } catch (err) {
    console.error('Failed to parse compressed stream state', err);
  }
  return null;
};

const parseStreamsParam = (value: string | null): EncodedStream[] => {
  if (!value) return [];
  return value
    .split('/')
    .map(segment => {
      if (!segment) return null;
      const [videoId, labelPart] = segment.split('~', 2);
      if (!videoId) return null;
      return {
        v: videoId,
        l: labelPart ? decodeURIComponent(labelPart) : undefined,
      };
    })
    .filter((entry): entry is EncodedStream => !!entry);
};

const parseLegacyStreamsParam = (value: string | null): EncodedStream[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((entry: any) => entry?.videoId)
        .map((entry: any) => ({
          v: entry.videoId,
          l: entry.label,
        }));
    }
  } catch (err) {
    console.error('Failed to parse legacy streams param', err);
  }
  return [];
};

const splitPathname = (pathname: string) => {
  if (!pathname) return { basePath: '/', videoIds: [] };
  const segments = pathname.split('/').filter(Boolean);
  const ids: string[] = [];
  let index = segments.length - 1;

  while (index >= 0 && /^[\w-]{5,}$/.test(segments[index])) {
    ids.unshift(segments[index]);
    index--;
  }

  const baseSegments = segments.slice(0, index + 1);
  const basePath = `/${baseSegments.join('/')}` || '/';
  return { basePath, videoIds: ids };
};

const App: React.FC = () => {
  const [urlInput, setUrlInput] = useState('');
  const [streams, setStreams] = useState<Stream[]>([]);
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const basePathRef = useRef('/');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const { basePath, videoIds: pathVideoIds } = splitPathname(window.location.pathname);
    basePathRef.current = basePath;

    const audioParam = params.get('audio') || undefined;
    let restoredStreams: Stream[] = pathVideoIds.length
      ? hydrateStreamsFromIds(pathVideoIds)
      : [];
    let activeVideoId: string | undefined = audioParam;

    if (!restoredStreams.length) {
      const streamsParamValue = params.get('streams');
      const streamEntries = parseStreamsParam(streamsParamValue);
      if (streamEntries.length) {
        restoredStreams = hydrateStreamsFromEntries(streamEntries);
      } else {
        const compressedState = parseCompressedState(params.get('s'));
        if (compressedState) {
          restoredStreams = hydrateStreamsFromEntries(compressedState.s);
          activeVideoId = compressedState.a;
        } else {
          const legacyEntries = parseLegacyStreamsParam(streamsParamValue);
          if (legacyEntries.length) {
            restoredStreams = hydrateStreamsFromEntries(legacyEntries);
          }
        }
      }
    }

    if (restoredStreams.length) {
      setStreams(restoredStreams);
      if (activeVideoId) {
        const audioStream = restoredStreams.find(stream => stream.videoId === activeVideoId);
        if (audioStream) {
          setActiveAudioId(audioStream.id);
        }
      }
    } else if (params.has('audio')) {
      params.delete('audio');
      const query = params.toString();
      const cleanUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
      window.history.replaceState(null, '', cleanUrl);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    params.delete('s');
    params.delete('streams');
    params.delete('audio');

    if (streams.length) {
      const serialized = streams
        .map(stream => `${stream.videoId}${stream.label ? `~${encodeURIComponent(stream.label)}` : ''}`)
        .join('/');
      params.set('streams', serialized);

      if (activeAudioId) {
        const activeStream = streams.find(stream => stream.id === activeAudioId);
        if (activeStream) {
          params.set('audio', activeStream.videoId);
        }
      }
    }

    const query = params.toString();
    const newUrl = `${basePathRef.current}${query ? `?${query}` : ''}`;
    const currentUrl = `${window.location.pathname}${window.location.search}`;

    if (newUrl !== currentUrl) {
      window.history.replaceState(null, '', newUrl);
    }
  }, [streams, activeAudioId]);

  const handleAddStream = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    if (!urlInput.trim()) return;

    const videoId = getYouTubeVideoId(urlInput);

    if (!videoId) {
      setError('Invalid YouTube URL. Please enter a valid link.');
      return;
    }

    // Check for duplicates
    if (streams.some(s => s.videoId === videoId)) {
        setError('This stream is already in the grid.');
        return;
    }

    const newStream: Stream = {
      id: generateId(),
      url: urlInput,
      videoId,
      addedAt: Date.now(),
      label: `Stream ${streams.length + 1}`,
    };

    setStreams(prev => [...prev, newStream]);
    
    // If it's the first stream, unmute it by default for better UX
    if (streams.length === 0) {
        setActiveAudioId(newStream.id);
    }

    setUrlInput('');
  };

  const handleRemoveStream = (id: string) => {
    setStreams(prev => prev.filter(s => s.id !== id));
    if (activeAudioId === id) {
      setActiveAudioId(null);
    }
  };

  const handleLabelChange = (id: string, label: string) => {
    setStreams(prev =>
      prev.map(stream =>
        stream.id === id ? { ...stream, label } : stream
      )
    );
  };

  const handleToggleAudio = (id: string) => {
    // If clicking the already active one, toggle it off (mute all)
    // Or strictly enforce "one must be on"? 
    // Requirement: "select a stream to turn the sound on... only one stream that has sound"
    // It implies we can switch. If I click the active one, maybe I want to mute everything?
    // Let's allow muting everything by clicking the active one again.
    if (activeAudioId === id) {
      setActiveAudioId(null);
    } else {
      setActiveAudioId(id);
    }
  };

  // Keyboard shortcut to focus input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
            e.preventDefault();
            document.getElementById('stream-input')?.focus();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100">
      
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <div className="bg-gradient-to-tr from-rose-600 to-orange-600 p-2 rounded-lg shadow-lg shadow-rose-900/20">
              <Tv size={20} className="text-white" />
            </div>
            <h1 className="text-lg font-bold tracking-tight hidden sm:block">
              MultiStream <span className="text-zinc-500 font-normal">Grid</span>
            </h1>
          </div>

          <form onSubmit={handleAddStream} className="flex-1 max-w-2xl relative group">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-rose-500 transition-colors">
               <Youtube size={18} />
            </div>
            <input
              id="stream-input"
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Paste YouTube Live link here... (Press '/')"
              className="w-full bg-zinc-900/50 border border-zinc-800 text-zinc-100 text-sm rounded-full py-2.5 pl-10 pr-12 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500/50 transition-all placeholder:text-zinc-600"
            />
            <button
              type="submit"
              disabled={!urlInput.trim()}
              className="absolute right-1.5 top-1.5 bottom-1.5 aspect-square bg-zinc-800 hover:bg-rose-600 text-zinc-400 hover:text-white rounded-full flex items-center justify-center transition-all disabled:opacity-50 disabled:hover:bg-zinc-800"
            >
              <Plus size={18} />
            </button>
          </form>

          <div className="shrink-0 flex items-center gap-3 text-sm text-zinc-500 hidden md:flex">
             <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{streams.length} Active</span>
             </div>
          </div>
        </div>
      </header>
      
      {/* Error Toast */}
      {error && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-2 px-4 py-2 bg-rose-950/90 border border-rose-800 text-rose-200 rounded-full shadow-xl backdrop-blur-md text-sm font-medium">
                <AlertCircle size={16} />
                {error}
                <button onClick={() => setError(null)} className="ml-2 hover:text-white"><Plus className="rotate-45" size={16}/></button>
            </div>
        </div>
      )}

      {/* Main Grid */}
      <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
        {streams.length === 0 ? (
          <div className="h-[70vh] flex flex-col items-center justify-center text-center p-8">
            <div className="bg-zinc-900 p-6 rounded-full mb-6 border border-zinc-800 shadow-2xl shadow-black">
                <LayoutGrid size={48} className="text-zinc-700" />
            </div>
            <h2 className="text-2xl font-bold text-zinc-200 mb-2">No Streams Added</h2>
            <p className="text-zinc-500 max-w-md mx-auto">
              Paste a YouTube Live URL in the bar above to get started. You can add multiple streams and control their audio individually.
            </p>
            <div className="mt-8 flex gap-3 text-xs text-zinc-600 uppercase tracking-widest font-semibold">
                <span>Supports</span>
                <span className="w-1 h-1 rounded-full bg-zinc-800 self-center"></span>
                <span>Live Streams</span>
                <span className="w-1 h-1 rounded-full bg-zinc-800 self-center"></span>
                <span>Videos</span>
                <span className="w-1 h-1 rounded-full bg-zinc-800 self-center"></span>
                <span>Shorts</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 auto-rows-min max-w-[1920px] mx-auto">
            {streams.map((stream) => (
              <StreamCard
                key={stream.id}
                stream={stream}
                isAudioActive={activeAudioId === stream.id}
                onToggleAudio={handleToggleAudio}
                onRemove={handleRemoveStream}
                onLabelChange={handleLabelChange}
              />
            ))}
          </div>
        )}
      </main>

    </div>
  );
};

export default App;
