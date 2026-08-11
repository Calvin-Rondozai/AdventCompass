import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';

export type ChunkOffset = { key: string; startMs: number; endMs: number };
type NowPlaying = { title: string; chunkOffsets: ChunkOffset[] };

type AudioPlayerContextValue = {
  nowPlaying: NowPlaying | null;
  playing: boolean;
  positionMs: number;
  durationMs: number;
  // The chunk (verse/paragraph) key whose time range contains the current playback
  // position — lets a reader screen highlight "what's being read" the same way it
  // already does for live Read Aloud's activeKey, just driven by real audio position
  // instead of a live TTS callback.
  activeKey: string | null;
  play: (uri: string, title: string, chunkOffsets: ChunkOffset[]) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  seekTo: (ms: number) => void;
};

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

// Configuring the audio mode is one-time, global device state — doing it every time the
// provider mounts (which is once, at the app root, but React StrictMode/Fast Refresh can
// still remount it) would just repeat a no-op call, but guarding it makes that explicit.
let backgroundModeConfigured = false;

// Mounted once near the app root (see app/_layout.tsx) so a track keeps playing — and
// the mini player keeps showing — across tab/screen navigation, not just within
// whichever reader screen started it.
export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const player = useAudioPlayer(null, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);

  useEffect(() => {
    if (backgroundModeConfigured) return;
    backgroundModeConfigured = true;
    setAudioModeAsync({ shouldPlayInBackground: true, interruptionMode: 'doNotMix', playsInSilentMode: true }).catch(() => {});
  }, []);

  const play = useCallback(
    (uri: string, title: string, chunkOffsets: ChunkOffset[]) => {
      player.replace({ uri, name: title });
      setNowPlaying({ title, chunkOffsets });
      player.play();
    },
    [player]
  );

  const pause = useCallback(() => player.pause(), [player]);
  const resume = useCallback(() => player.play(), [player]);
  const stop = useCallback(() => {
    player.pause();
    setNowPlaying(null);
  }, [player]);
  const seekTo = useCallback(
    (ms: number) => {
      player.seekTo(ms / 1000).catch(() => {});
    },
    [player]
  );

  // Clears the mini player once playback reaches the end, instead of leaving it showing
  // a finished, paused track that "resume" would just replay from the start of.
  useEffect(() => {
    if (status?.didJustFinish) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.didJustFinish]);

  const positionMs = (status?.currentTime ?? 0) * 1000;
  const durationMs = (status?.duration ?? 0) * 1000;

  const activeKey = useMemo(() => {
    if (!nowPlaying) return null;
    return nowPlaying.chunkOffsets.find((c) => positionMs >= c.startMs && positionMs < c.endMs)?.key ?? null;
  }, [nowPlaying, positionMs]);

  const value = useMemo<AudioPlayerContextValue>(
    () => ({
      nowPlaying,
      playing: !!status?.playing,
      positionMs,
      durationMs,
      activeKey,
      play,
      pause,
      resume,
      stop,
      seekTo,
    }),
    [nowPlaying, status?.playing, positionMs, durationMs, activeKey, play, pause, resume, stop, seekTo]
  );

  return <AudioPlayerContext.Provider value={value}>{children}</AudioPlayerContext.Provider>;
}

export function useAudioPlayerContext(): AudioPlayerContextValue {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) throw new Error('useAudioPlayerContext must be used within AudioPlayerProvider');
  return ctx;
}
