import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { useSQLiteContext } from 'expo-sqlite';
import { getKv, setKv } from '@/database/kv';

export type ReadAloudChunk = { key: string; text: string };
export type ReadAloudState = 'idle' | 'speaking' | 'paused';

const RATE_KEY = 'tts_rate';
const VOICE_KEY = 'tts_voice';

// expo-speech has no queueing concept of its own beyond "call speak() again while
// something is playing" — this hook turns a list of chunks (verses, paragraphs,
// commentary entries) into a sequential read-through, tracking which chunk is
// currently sounding (activeKey) so the calling screen can highlight + auto-scroll
// to it, matching how VerseHighlight/flashVerse already work in the Bible reader.
//
// Android's TextToSpeech has no native pause/resume (Speech.pause/resume are iOS +
// Web only) — pausing on Android instead stops the engine and remembers the chunk
// index, and resuming re-speaks that chunk from its start. That's a real behavior
// difference from iOS (which resumes mid-utterance), but utterances are already
// chunked at verse/paragraph granularity, so re-starting the current chunk reads
// as "resume" rather than a jarring restart.
export function useReadAloud() {
  const db = useSQLiteContext();
  const [state, setState] = useState<ReadAloudState>('idle');
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [rate, setRateState] = useState(1.0);
  const [voice, setVoiceState] = useState<string | null>(null);

  const chunksRef = useRef<ReadAloudChunk[]>([]);
  const indexRef = useRef(0);
  // True only while a play()/resume() session should keep auto-advancing on
  // onDone — set false by stop()/pause() so an in-flight callback from the
  // utterance being cancelled can't chain into the next one.
  const sessionRef = useRef(false);
  const rateRef = useRef(1.0);
  const voiceRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getKv(db, RATE_KEY), getKv(db, VOICE_KEY)]).then(([r, v]) => {
      if (cancelled) return;
      if (r) {
        const n = Number(r);
        if (!Number.isNaN(n)) {
          setRateState(n);
          rateRef.current = n;
        }
      }
      if (v) {
        setVoiceState(v);
        voiceRef.current = v;
      }
    });
    return () => {
      cancelled = true;
    };
  }, [db]);

  const setRate = useCallback(
    (next: number) => {
      setRateState(next);
      rateRef.current = next;
      setKv(db, RATE_KEY, String(next)).catch(() => {});
    },
    [db]
  );

  const setVoice = useCallback(
    (next: string | null) => {
      setVoiceState(next);
      voiceRef.current = next;
      setKv(db, VOICE_KEY, next ?? '').catch(() => {});
    },
    [db]
  );

  const speakFrom = useCallback((idx: number) => {
    const chunks = chunksRef.current;
    if (idx < 0 || idx >= chunks.length) {
      sessionRef.current = false;
      setState('idle');
      setActiveKey(null);
      return;
    }
    indexRef.current = idx;
    const chunk = chunks[idx];
    setActiveKey(chunk.key);
    setState('speaking');
    Speech.speak(chunk.text, {
      rate: rateRef.current,
      voice: voiceRef.current ?? undefined,
      onDone: () => {
        if (sessionRef.current) speakFrom(idx + 1);
      },
      onError: () => {
        if (sessionRef.current) speakFrom(idx + 1);
      },
    });
  }, []);

  const play = useCallback(
    (chunks: ReadAloudChunk[], fromKey?: string) => {
      Speech.stop();
      chunksRef.current = chunks;
      sessionRef.current = true;
      const startIdx = fromKey ? Math.max(0, chunks.findIndex((c) => c.key === fromKey)) : 0;
      speakFrom(startIdx);
    },
    [speakFrom]
  );

  const pause = useCallback(() => {
    if (Platform.OS === 'ios' || Platform.OS === 'web') {
      Speech.pause();
      setState('paused');
    } else {
      sessionRef.current = false;
      Speech.stop();
      setState('paused');
    }
  }, []);

  const resume = useCallback(() => {
    if (Platform.OS === 'ios' || Platform.OS === 'web') {
      Speech.resume();
      setState('speaking');
    } else {
      sessionRef.current = true;
      speakFrom(indexRef.current);
    }
  }, [speakFrom]);

  const stop = useCallback(() => {
    sessionRef.current = false;
    Speech.stop();
    setState('idle');
    setActiveKey(null);
  }, []);

  const skip = useCallback(
    (direction: 1 | -1) => {
      if (chunksRef.current.length === 0) return;
      Speech.stop();
      sessionRef.current = true;
      speakFrom(indexRef.current + direction);
    },
    [speakFrom]
  );

  // Stop on unmount so leaving the chapter (or the app) doesn't leave the device
  // talking about a screen that's no longer on screen.
  useEffect(
    () => () => {
      sessionRef.current = false;
      Speech.stop();
    },
    []
  );

  // Every reader screen's own callbacks (toggleReadAloudOpen, handlePlayPause, ...)
  // depend on this whole object rather than picking out individual fields, and those
  // callbacks in turn sit in a navigation.setOptions() useLayoutEffect's deps array —
  // without this memo, a fresh object identity every render meant the header was
  // being rebuilt on every render of the chapter screen (any scroll tick, any
  // bookmark toggle), not just on real chapter/state changes, which was the actual
  // cause of chapters feeling slower to open after this hook was added.
  return useMemo(
    () => ({ state, activeKey, play, pause, resume, stop, skip, rate, setRate, voice, setVoice }),
    [state, activeKey, play, pause, resume, stop, skip, rate, setRate, voice, setVoice]
  );
}
