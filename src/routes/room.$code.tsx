import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState, useCallback } from 'react';
import { socket } from '../socket';
import { TrackSearch } from '../components/ui/TrackSearch';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { 
  Play, 
  Pause, 
  SkipForward, 
  ThumbsUp, 
  Trash2, 
  Send, 
  Users, 
  Copy, 
  Check, 
  Crown, 
  Headphones, 
  Radio,
  LogOut,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/room/$code')({
  component: RoomComponent,
});

interface Track {
  id: string;
  title: string;
  artist: string;
  duration: number;
  thumbnail?: string;
  addedBy?: string;
  addedBySessionId?: string;
}

interface Participant {
  id: string;
  name: string;
  role: 'HOST' | 'CO_DJ' | 'LISTENER';
}

interface ChatMessage {
  id: string;
  sender: string;
  senderSessionId?: string;
  message: string;
  timestamp: number;
}

interface Reaction {
  id: string;
  emoji: string;
  senderSessionId?: string;
}

// Local Session & Ephemeral Reconnect Secret Storage
const getOrCreateSessionId = (): string => {
  let id = localStorage.getItem('chillx_session_id');
  if (!id) {
    id = `sess-${Math.random().toString(36).substring(2, 10)}-${Date.now().toString(36)}`;
    localStorage.setItem('chillx_session_id', id);
  }
  return id;
};

const getStoredSecret = (code: string): string | null => 
  sessionStorage.getItem(`chillx_reconnect_${code}`);

const setStoredSecret = (code: string, secret: string): void => 
  sessionStorage.setItem(`chillx_reconnect_${code}`, secret);

const clearStoredSecret = (code: string): void => 
  sessionStorage.removeItem(`chillx_reconnect_${code}`);

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export function RoomComponent() {
  const { code } = Route.useParams();
  const navigate = useNavigate();

  // User & Identity State
  const [sessionId] = useState<string>(getOrCreateSessionId);
  const [username, setUsername] = useState<string>(() => {
    return localStorage.getItem('chillx_username') || `Guest_${Math.floor(Math.random() * 9000 + 1000)}`;
  });
  const [userRole, setUserRole] = useState<'HOST' | 'CO_DJ' | 'LISTENER'>('LISTENER');

  // Room State
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [queue, setQueue] = useState<Track[]>([]);
  const [skipVotes, setSkipVotes] = useState<{ count: number; needed: number }>({ count: 0, needed: 1 });
  const [hasVotedSkip, setHasVotedSkip] = useState<boolean>(false);

  // Communication & Reactions
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [reactions, setReactions] = useState<Reaction[]>([]);

  // UI & Player Control State
  const [copied, setCopied] = useState<boolean>(false);
  const playerRef = useRef<any>(null);
  const [isPlayerReady, setIsPlayerReady] = useState<boolean>(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState<boolean>(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const pendingSyncRef = useRef<{ position: number; isPlaying: boolean } | null>(null);

  const isDJ = userRole === 'HOST' || userRole === 'CO_DJ';

  // Apply Authoritative State Sync from Server
  const applyAuthoritativeSync = useCallback((state: any) => {
    if (!state) return;

    if (state.queue) {
      setQueue(state.queue);
    }

    if (typeof state.skipVotesCount === 'number' && typeof state.skipVotesNeeded === 'number') {
      setSkipVotes({ count: state.skipVotesCount, needed: state.skipVotesNeeded });
    }

    if (state.playback) {
      const { currentTrack: track, isPlaying: playing, position, serverTime } = state.playback;
      setCurrentTrack(track || null);
      setIsPlaying(Boolean(playing));

      // Drift correction calculation based on server timestamp
      const latency = serverTime ? Math.max(0, (Date.now() - serverTime) / 1000) : 0;
      const targetTime = (position || 0) + (playing ? latency : 0);

      if (playerRef.current && isPlayerReady) {
        syncPlayer(targetTime, Boolean(playing));
      } else {
        pendingSyncRef.current = { position: targetTime, isPlaying: Boolean(playing) };
      }
    }
  }, [isPlayerReady]);

  // Player Synchronization with 1.5s Drift Threshold
  const syncPlayer = (targetTime: number, shouldPlay: boolean) => {
    if (!playerRef.current || typeof playerRef.current.getCurrentTime !== 'function') return;

    try {
      const currentTime = playerRef.current.getCurrentTime();
      const drift = Math.abs(currentTime - targetTime);

      if (drift > 1.5) {
        playerRef.current.seekTo(targetTime, true);
      }

      const playerState = playerRef.current.getPlayerState();
      if (shouldPlay && playerState !== 1) {
        playerRef.current.playVideo().catch?.(() => {
          setAutoplayBlocked(true);
        });
      } else if (!shouldPlay && playerState === 1) {
        playerRef.current.pauseVideo();
      }
    } catch (e) {
      console.error('Player sync error:', e);
    }
  };

  // YouTube IFrame API Initialization
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }

    window.onYouTubeIframeAPIReady = () => {
      initPlayer();
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    }

    function initPlayer() {
      if (playerRef.current) return;
      playerRef.current = new window.YT.Player('youtube-player', {
        height: '100%',
        width: '100%',
        videoId: currentTrack?.id || '',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            setIsPlayerReady(true);
            if (pendingSyncRef.current) {
              syncPlayer(pendingSyncRef.current.position, pendingSyncRef.current.isPlaying);
              pendingSyncRef.current = null;
            }
          },
          onStateChange: (event: any) => {
            if (event.data === 0 && isDJ) {
              // Video ended -> democratic skip or natural advancement
              socket.emit('queue:vote_skip', { roomCode: code });
            }
          },
          onError: (err: any) => {
            console.error('YouTube Player Error:', err);
          }
        },
      });
    }

    return () => {
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [code, isDJ]);

  // Update YouTube Video ID when Current Track changes
  useEffect(() => {
    if (isPlayerReady && playerRef.current && currentTrack?.id) {
      const currentVideoId = playerRef.current.getVideoData?.()?.video_id;
      if (currentVideoId !== currentTrack.id) {
        playerRef.current.loadVideoById(currentTrack.id, 0);
        setHasVotedSkip(false);
      }
    }
  }, [currentTrack?.id, isPlayerReady]);

  // Socket.IO Room Connection & Event Registration
  useEffect(() => {
    const connectAndJoin = () => {
      const secret = getStoredSecret(code);

      socket.emit(
        'room:join',
        {
          roomCode: code,
          sessionId,
          username,
          reconnectSecret: secret || undefined,
        },
        (res: { success?: boolean; role?: string; state?: any; reconnectSecret?: string; error?: string }) => {
          if (res?.error) {
            if (res.error === 'Invalid reconnect credentials' || res.error === 'Session already active in this room') {
              clearStoredSecret(code);
            }
            toast.error(res.error);
            return;
          }

          if (res?.reconnectSecret) {
            setStoredSecret(code, res.reconnectSecret);
          }

          if (res?.role) {
            setUserRole(res.role as 'HOST' | 'CO_DJ' | 'LISTENER');
          }

          if (res?.state) {
            applyAuthoritativeSync(res.state);
          }
        }
      );
    };

    if (socket.connected) {
      connectAndJoin();
    } else {
      socket.connect();
    }

    socket.on('connect', connectAndJoin);

    socket.on('room:participants', (updatedParticipants: Participant[]) => {
      setParticipants(updatedParticipants);
      const me = updatedParticipants.find(p => p.id === sessionId);
      if (me && me.role !== userRole) {
        setUserRole(me.role);
      }
    });

    socket.on('player:sync', applyAuthoritativeSync);

    socket.on('player:play', ({ position, serverTime }) => {
      setIsPlaying(true);
      const latency = serverTime ? Math.max(0, (Date.now() - serverTime) / 1000) : 0;
      if (playerRef.current && isPlayerReady) {
        syncPlayer(position + latency, true);
      }
    });

    socket.on('player:pause', ({ position }) => {
      setIsPlaying(false);
      if (playerRef.current && isPlayerReady) {
        syncPlayer(position, false);
      }
    });

    socket.on('player:seek', ({ position, serverTime }) => {
      const latency = serverTime ? Math.max(0, (Date.now() - serverTime) / 1000) : 0;
      if (playerRef.current && isPlayerReady) {
        playerRef.current.seekTo(position + latency, true);
      }
    });

    socket.on('player:track_change', ({ track, position }) => {
      setCurrentTrack(track || null);
      setHasVotedSkip(false);
      if (!track) {
        setIsPlaying(false);
        if (playerRef.current && isPlayerReady) {
          playerRef.current.stopVideo();
        }
      } else if (playerRef.current && isPlayerReady) {
        playerRef.current.loadVideoById(track.id, position || 0);
        playerRef.current.playVideo();
        setIsPlaying(true);
      }
    });

    socket.on('queue:update', (updatedQueue: Track[]) => {
      setQueue(updatedQueue);
    });

    socket.on('queue:skip_votes_update', ({ skipVotesCount, skipVotesNeeded }) => {
      setSkipVotes({ count: skipVotesCount, needed: skipVotesNeeded });
    });

    socket.on('chat:message', (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg]);
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    });

    socket.on('reaction:new', (rx: Reaction) => {
      setReactions(prev => [...prev, rx]);
      setTimeout(() => {
        setReactions(prev => prev.filter(item => item.id !== rx.id));
      }, 4000);
    });

    return () => {
      socket.off('connect', connectAndJoin);
      socket.off('room:participants');
      socket.off('player:sync');
      socket.off('player:play');
      socket.off('player:pause');
      socket.off('player:seek');
      socket.off('player:track_change');
      socket.off('queue:update');
      socket.off('queue:skip_votes_update');
      socket.off('chat:message');
      socket.off('reaction:new');
    };
  }, [code, sessionId, username, isPlayerReady, applyAuthoritativeSync, userRole]);

  // Playback Control Handlers
  const handleTogglePlay = () => {
    if (!isDJ) return;
    if (isPlaying) {
      socket.emit('player:pause', { roomCode: code });
    } else {
      socket.emit('player:play', { roomCode: code });
    }
  };

  const handleVoteSkip = () => {
    if (hasVotedSkip) return;
    socket.emit('queue:vote_skip', { roomCode: code });
    setHasVotedSkip(true);
    toast.success('Skip vote recorded');
  };

  const handleRemoveTrack = (index: number) => {
    if (!Number.isInteger(index)) return;
    socket.emit('queue:remove', { roomCode: code, index });
  };

  const handleSetRole = (targetSessionId: string, role: 'CO_DJ' | 'LISTENER') => {
    if (userRole !== 'HOST') return;
    socket.emit('room:set_role', {
      roomCode: code,
      targetSessionId,
      role,
    });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = chatInput.trim();
    if (!clean) return;
    socket.emit('chat:send', { roomCode: code, message: clean });
    setChatInput('');
  };

  const handleSendReaction = (emoji: string) => {
    socket.emit('reaction:send', { roomCode: code, emoji });
  };

  const handleLeaveRoom = () => {
    clearStoredSecret(code);
    socket.disconnect();
    navigate({ to: '/' });
  };

  const copyInvite = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Room link copied to clipboard!');
  };

  const unlockAutoplay = () => {
    if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
      playerRef.current.playVideo();
      setAutoplayBlocked(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-4 md:p-6 flex flex-col gap-6 relative overflow-hidden">
      {/* Floating Reactions Overlay */}
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        {reactions.map((rx) => (
          <div
            key={rx.id}
            className="absolute bottom-20 animate-float text-4xl"
            style={{
              left: `${Math.floor(Math.random() * 80 + 10)}%`,
              animationDuration: '3.5s',
            }}
          >
            {rx.emoji}
          </div>
        ))}
      </div>

      {/* Header Bar */}
      <header className="flex flex-wrap items-center justify-between gap-4 bg-neutral-900/60 p-4 rounded-xl border border-neutral-800 backdrop-blur">
        <div className="flex items-center gap-3">
          <Radio className="w-6 h-6 text-indigo-500 animate-pulse" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">Chill_X Listening Lounge</h1>
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <span>Room: <strong className="text-neutral-200">{code}</strong></span>
              <Separator orientation="vertical" className="h-3" />
              <Badge variant="outline" className="border-indigo-500/30 text-indigo-400">
                {userRole === 'HOST' ? 'Host' : userRole === 'CO_DJ' ? 'Co-DJ' : 'Listener'}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={copyInvite} className="gap-2 border-neutral-700">
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Invite'}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleLeaveRoom} className="gap-2">
            <LogOut className="w-4 h-4" />
            Leave
          </Button>
        </div>
      </header>

      {/* Main Grid: Player, Queue, and Sidebars */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        {/* Left / Center Column: Player & Queue */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* YouTube Player Wrapper */}
          <Card className="bg-neutral-900/80 border-neutral-800 overflow-hidden flex flex-col">
            <div className="relative aspect-video w-full bg-black flex items-center justify-center">
              <div id="youtube-player" className="w-full h-full" />
              {autoplayBlocked && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-3 z-10 p-4 text-center">
                  <p className="text-sm text-neutral-300">Browser blocked autoplay audio</p>
                  <Button onClick={unlockAutoplay} className="bg-indigo-600 hover:bg-indigo-500">
                    Click to Enable Sound
                  </Button>
                </div>
              )}
            </div>

            <CardContent className="p-4 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <div className="overflow-hidden">
                  <h3 className="font-semibold text-lg truncate">
                    {currentTrack?.title || 'No track playing'}
                  </h3>
                  <p className="text-sm text-neutral-400 truncate">
                    {currentTrack?.artist || 'Add songs from the search below'}
                  </p>
                </div>

                {/* DJ Controls */}
                <div className="flex items-center gap-2">
                  {isDJ && (
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={handleTogglePlay}
                      disabled={!currentTrack}
                      className="h-10 w-10 bg-indigo-600 hover:bg-indigo-500 text-white"
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleVoteSkip}
                    disabled={!currentTrack || hasVotedSkip}
                    className="gap-2 border-neutral-700"
                  >
                    <SkipForward className="w-4 h-4" />
                    Skip ({skipVotes.count}/{skipVotes.needed})
                  </Button>
                </div>
              </div>

              {/* Floating Reaction Bar */}
              <div className="flex items-center gap-2 pt-2 border-t border-neutral-800">
                <span className="text-xs text-neutral-400 mr-2 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> React:
                </span>
                {['🔥', '❤️', '👏', '💃', '🎉', '🎶'].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleSendReaction(emoji)}
                    className="text-lg hover:scale-125 transition-transform px-2 py-1 bg-neutral-800/50 hover:bg-neutral-800 rounded-md"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Search & Add Track Section */}
          <Card className="bg-neutral-900/60 border-neutral-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Add to Lounge Queue</CardTitle>
            </CardHeader>
            <CardContent>
              <TrackSearch
                onSelectTrack={(track) => {
                  socket.emit('queue:add', { roomCode: code, track });
                  toast.success(`Queued: ${track.title}`);
                }}
              />
            </CardContent>
          </Card>

          {/* Queue List */}
          <Card className="bg-neutral-900/60 border-neutral-800 flex-1">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-medium">Upcoming Tracks ({queue.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-64 px-4">
                {queue.length === 0 ? (
                  <div className="text-center py-8 text-neutral-500 text-sm">
                    The queue is empty. Search above to add songs!
                  </div>
                ) : (
                  <div className="flex flex-col divide-y divide-neutral-800">
                    {queue.map((track, idx) => (
                      <div key={`${track.id}-${idx}`} className="flex items-center justify-between py-3 gap-3">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <span className="text-xs font-mono text-neutral-500 w-4">{idx + 1}</span>
                          {track.thumbnail && (
                            <img src={track.thumbnail} alt="" className="w-10 h-10 object-cover rounded" />
                          )}
                          <div className="overflow-hidden">
                            <p className="text-sm font-medium truncate">{track.title}</p>
                            <p className="text-xs text-neutral-400 truncate">
                              {track.artist} {track.addedBy ? `• Added by ${track.addedBy}` : ''}
                            </p>
                          </div>
                        </div>

                        {(isDJ || track.addedBySessionId === sessionId) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveTrack(idx)}
                            className="text-neutral-500 hover:text-rose-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Participants & Real-time Chat */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Participants Card */}
          <Card className="bg-neutral-900/60 border-neutral-800">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                Listening Now ({participants.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-44 px-4">
                <div className="flex flex-col divide-y divide-neutral-800">
                  {participants.map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="w-7 h-7">
                          <AvatarFallback className="text-xs bg-neutral-800 text-neutral-300">
                            {p.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm truncate">
                          {p.name} {p.id === sessionId && '(You)'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {p.role === 'HOST' ? (
                          <span title="Host">
                            <Crown className="w-4 h-4 text-amber-400" />
                          </span>
                        ) : p.role === 'CO_DJ' ? (
                          <span title="Co-DJ">
                            <Headphones className="w-4 h-4 text-indigo-400" />
                          </span>
                        ) : null}

                        {userRole === 'HOST' && p.id !== sessionId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7 px-2"
                            onClick={() => handleSetRole(p.id, p.role === 'CO_DJ' ? 'LISTENER' : 'CO_DJ')}
                          >
                            {p.role === 'CO_DJ' ? 'Demote' : 'Make DJ'}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Real-time Room Chat */}
          <Card className="bg-neutral-900/60 border-neutral-800 flex-1 flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Lounge Chat</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-4 pt-0 justify-between gap-3">
              <ScrollArea className="h-64 pr-2">
                <div className="flex flex-col gap-2">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`text-xs p-2 rounded-lg max-w-[85%] ${
                        m.senderSessionId === sessionId
                          ? 'bg-indigo-600/30 border border-indigo-500/30 self-end'
                          : 'bg-neutral-800/50 border border-neutral-800 self-start'
                      }`}
                    >
                      <span className="font-semibold text-neutral-300 mr-1">{m.sender}:</span>
                      <span className="text-neutral-200">{m.message}</span>
                    </div>
                  ))}
                  <div ref={chatBottomRef} />
                </div>
              </ScrollArea>

              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Say something..."
                  maxLength={300}
                  className="bg-neutral-950 border-neutral-800 text-xs"
                />
                <Button type="submit" size="icon" className="h-9 w-9 bg-indigo-600 hover:bg-indigo-500 shrink-0">
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}