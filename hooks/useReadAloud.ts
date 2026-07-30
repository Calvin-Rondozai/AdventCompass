import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { getKv, setKv } from '@/database/kv';
import { getSpeech } from '@/services/speechEngine';

export type ReadAloudChunk = { key: string; text: string };
export type ReadAloudState = 'idle' | 'speaking' | 'paused';

const RATE_KEY = 'tts_rate';
const VOICE_KEY = 'tts_voice';

// Three designs were tried here before this one, each broken in a different way:
//
// 1. Call speak() for the NEXT chunk from inside the PREVIOUS chunk's onDone
//    callback. That's a re-entrant call into the native bridge while it's still
//    tearing down the finishing utterance's listeners — on-device that raced: the
//    first chunk played (at least partially) but everything after it fired onDone
//    almost instantly with no real audio, reading as "says the first word, then
//    just the highlight keeps moving."
// 2. Enqueue the WHOLE remaining batch up front in one loop, relying on
//    expo-speech's documented "queues if already speaking" behavior. That avoided
//    the re-entrant call, but registering dozens of simultaneous pending utterances
//    (a full EGW chapter or Sabbath School day easily has 50-100+ chunks, vs. a
//    Bible chapter's handful of short verses) overwhelmed something in expo-speech's
//    callback tracking — the same glitch came back on the two longer-content
//    readers.
// 3. One utterance at a time, continuing via a setTimeout(0)-deferred call to
//    speakFrom() from inside onDone/onError, gated by a single shared boolean
//    (`sessionRef`). That fixed the original glitch, but the boolean has no way to
//    tell "this specific chunk's callback" apart from "whatever is happening now" —
//    a skip()/pause()/resume() issued while a deferred continuation was still
//    in-flight raced it: the old continuation and the new action could both call
//    speakFrom() for the same or a stale index, double-speaking a chunk or jumping
//    the highlight ahead of a chunk that's still (re)playing.
//
// This version keeps #3's one-at-a-time approach and its setTimeout(0) deferral,
// but replaces the shared boolean with a monotonically increasing session id.
// Every user-initiated action (play/pause/resume/skip/stop) bumps the id first —
// so a chunk's onDone/onError/watchdog closure (which captured the id in scope at
// the moment it was issued) can tell it's been superseded and become a no-op,
// instead of racing whatever the new action started.
//
// Pause/resume are also now identical on every platform: stop and remember the
// chunk index, then resume by re-speaking from that index. expo-speech's
// Speech.pause()/resume() (iOS/Web only — Android has no native pause at all) sound
// appealing since they can resume mid-utterance, but they operate on the SAME
// utterance object across the pause, and reconciling that with the id-invalidation
// scheme above got genuinely fragile — a pause landing at nearly the same instant
// as the utterance's own natural completion is a real race, not a theoretical one.
// Utterances are already chunked at verse/paragraph granularity, so restarting the
// current chunk on resume reads as "resume" rather than a jarring restart, and
// unifying the behavior removes an entire platform-conditional bug surface.
export function useReadAloud() {
  const db = useSQLiteContext();
  const [state, setState] = useState<ReadAloudState>('idle');
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [rate, setRateState] = useState(1.0);
  const [voice, setVoiceState] = useState<string | null>(null);

  const chunksRef = useRef<ReadAloudChunk[]>([]);
  const indexRef = useRef(0);
  const rateRef = useRef(1.0);
  const voiceRef = useRef<string | null>(null);
  // Bumped by every play/pause/resume/skip/stop/unmount — see the design note above.
  const sessionIdRef = useRef(0);
  // True once play() has actually run at least once this mount — guards every other
  // Speech call (stop() from the chapter-reset effect, the unmount cleanup, ...) so
  // they stay pure no-ops, never touching getSpeech(), until Read Aloud was used.
  const everPlayedRef = useRef(false);

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
      setState('idle');
      setActiveKey(null);
      return;
    }
    const mySessionId = sessionIdRef.current;
    indexRef.current = idx;
    const chunk = chunks[idx];
    setActiveKey(chunk.key);
    setState('speaking');

    let settled = false;
    let watchdogId: ReturnType<typeof setTimeout> | null = null;
    const finishChunk = () => {
      if (settled) return;
      settled = true;
      if (watchdogId != null) clearTimeout(watchdogId);
      if (sessionIdRef.current !== mySessionId) return; // superseded — see design note above
      // Must not call speakFrom() synchronously from here — see design note #1
      // above on the re-entrancy bug that caused.
      setTimeout(() => {
        if (sessionIdRef.current === mySessionId) speakFrom(idx + 1);
      }, 0);
    };

    // A handful of on-device TTS engines never fire onDone/onError for a rejected
    // or stalled utterance (an empty/degenerate chunk that slipped through, or a
    // genuine engine hiccup) — without this, that leaves state stuck on "speaking"
    // and the highlight frozen forever, with no way out but the user manually
    // skipping. 120ms/char is far slower than any real speech rate, so under
    // normal conditions this fires never; it's a deadman's switch, not a timer.
    watchdogId = setTimeout(finishChunk, Math.max(15_000, chunk.text.length * 120));

    getSpeech().speak(chunk.text, {
      rate: rateRef.current,
      voice: voiceRef.current ?? undefined,
      onDone: finishChunk,
      onError: finishChunk,
    });
  }, []);

  const play = useCallback(
    (chunks: ReadAloudChunk[], fromKey?: string) => {
      const nonEmpty = chunks.filter((c) => c.text.trim().length > 0);
      if (nonEmpty.length === 0) return;
      sessionIdRef.current++;
      everPlayedRef.current = true;
      getSpeech().stop();
      chunksRef.current = nonEmpty;
      const startIdx = fromKey ? Math.max(0, nonEmpty.findIndex((c) => c.key === fromKey)) : 0;
      speakFrom(startIdx);
    },
    [speakFrom]
  );

  const pause = useCallback(() => {
    if (!everPlayedRef.current) return;
    sessionIdRef.current++;
    getSpeech().stop();
    setState('paused');
  }, []);

  const resume = useCallback(() => {
    if (!everPlayedRef.current) return;
    sessionIdRef.current++;
    speakFrom(indexRef.current);
  }, [speakFrom]);

  const stop = useCallback(() => {
    sessionIdRef.current++;
    if (everPlayedRef.current) getSpeech().stop();
    setState('idle');
    setActiveKey(null);
  }, []);

  const skip = useCallback(
    (direction: 1 | -1) => {
      if (!everPlayedRef.current || chunksRef.current.length === 0) return;
      sessionIdRef.current++;
      getSpeech().stop();
      // Clamped at 0 rather than letting a "skip back" at the very first chunk
      // fall through speakFrom's out-of-range branch, which treats any negative
      // index the same as "end of content" and exits Read Aloud entirely — an
      // extra tap of skip-back near the start of a chapter shouldn't silently
      // kill the session.
      speakFrom(Math.max(0, indexRef.current + direction));
    },
    [speakFrom]
  );

  // Stop on unmount so leaving the chapter (or the app) doesn't leave the device
  // talking about a screen that's no longer on screen. Skipped entirely if Read
  // Aloud was never used this mount — the overwhelmingly common case.
  useEffect(
    () => () => {
      sessionIdRef.current++;
      if (everPlayedRef.current) getSpeech().stop();
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
