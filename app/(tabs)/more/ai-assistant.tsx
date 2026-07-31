import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, FlatList, Keyboard, Platform, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { File } from 'expo-file-system';
import { Sparkles, ArrowUp, Link2, Settings } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import {
  ActiveModelInfo,
  describeDownloadError,
  downloadModel,
  getActiveModelInfo,
  getLastDownloadProgress,
  hasImportedModel,
  hasModel,
  importModel,
  isDownloadingModel,
  setModelSource,
  DownloadProgress,
} from '@/services/aiModel';
import { AI_INFERENCE_AVAILABLE, askAssistant, ChatMessage, resetConversation, restoreConversationHistory } from '@/services/aiAssistant';
import { warmContext } from '@/services/llm';
import { AnswerMode, getAnswerMode, setAnswerMode } from '@/services/aiSettings';
import { GROQ_AVAILABLE } from '@/services/groqAssistant';
import { clearChatHistory, loadChatHistory, saveChatHistory } from '@/services/aiChatHistory';
import { ensureSearchIndexBuilt, resolveSourceLink, SearchChunk } from '@/database/searchIndex';
import { findScriptureRefs } from '@/database/scriptureRefs';
import { showAlert } from '@/components/ui/AppAlert';
import { PressableScale } from '@/components/ui/PressableScale';
import { AISettingsSheet } from '@/components/ai/AISettingsSheet';
import { VersePopup, VerseRef } from '@/components/bible/VersePopup';
import { Body, Label } from '@/components/ui/Typography';
import { newLocalId } from '@/utils/localId';

const GREETING: ChatMessage = {
  id: 'greeting',
  role: 'assistant',
  text: "Hi! Ask me about a verse, a topic, or what the Bible or Ellen White's writings say. I'll always say exactly where an answer came from.",
};

function formatBytes(bytes: number): string {
  if (!bytes) return '0 MB';
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

function formatTime(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

// A cited verse ("John 3:16", "Rom. 5:8") anywhere in an assistant answer becomes
// tappable, popping up that verse right here instead of the reply just naming a
// reference the user has to go look up themselves — same pattern already used for
// commentary entries and Sabbath School lesson text (see findScriptureRefs).
function renderMessageText(text: string, linkColor: string, onPressRef: (ref: VerseRef) => void) {
  const refs = findScriptureRefs(text);
  if (refs.length === 0) return text;
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  refs.forEach((ref, i) => {
    if (ref.start > cursor) nodes.push(text.slice(cursor, ref.start));
    nodes.push(
      <Body
        key={i}
        style={{ color: linkColor, textDecorationLine: 'underline' }}
        onPress={() => onPressRef({ book: ref.book, chapter: ref.chapter, verse: ref.verse, verseEnd: ref.verseEnd })}
      >
        {ref.text}
      </Body>
    );
    cursor = ref.end;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

// Pairs each user message with the assistant message immediately following it — a
// reasonable approximation of the real Q&A turns askAssistant itself tracks (see
// conversationHistory in aiAssistant.ts), good enough to seed the model's memory back
// from a persisted transcript. A user question followed by more than one assistant
// bubble (a multi-section answer) only contributes its first section here; that's a
// minor simplification, not a correctness issue — this only feeds a soft form of
// context, not anything reconstructing the exact original list of chunks used.
function reconstructTurns(messages: ChatMessage[]): { question: string; answer: string }[] {
  const turns: { question: string; answer: string }[] = [];
  for (let i = 0; i < messages.length - 1; i++) {
    if (messages[i].role === 'user' && messages[i + 1].role === 'assistant') {
      turns.push({ question: messages[i].text, answer: messages[i + 1].text });
    }
  }
  return turns;
}

// Cycled while waiting for the model's first token (prompt prefill on a 1B model can
// take a few real seconds) — a plain three-dot bubble that never changes reads as
// "frozen" past a couple of seconds, so the label rotates to keep it legible as progress.
const THINKING_PHRASES = ['Thinking…', 'Ummmh…', 'Digging…', 'Almost there…', 'Putting together…', 'Wait…', 'ummmh...', 'Hold on…', 'One moment…', 'Just a sec…', 'Working…', 'Almost done…', 'Hang tight…', 'Let me see…', 'Checking…'];

function ThinkingBubble() {
  const theme = useTheme();
  const [phraseIndex, setPhraseIndex] = useState(0);
  // Plain Animated (not Moti/Reanimated) for this one deliberately — it's the simplest
  // tool that reliably does a 3-dot loop, with no dependency on this project's newer
  // Reanimated 4 + separate react-native-worklets setup, which is still unverified in a
  // real dev build.
  const dotAnims = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex((i) => (i + 1) % THINKING_PHRASES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loops = dotAnims.map((value, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(value, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(value, { toValue: 0, duration: 350, useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [dotAnims]);

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surfaceMuted,
        borderRadius: theme.radius.md,
        borderBottomLeftRadius: 4,
        padding: theme.spacing.sm + 2,
        gap: theme.spacing.xs,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {dotAnims.map((value, i) => (
          <Animated.View
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: theme.colors.textFaint,
              opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
              transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
            }}
          />
        ))}
      </View>
      <Label style={{ color: theme.colors.textMuted }}>{THINKING_PHRASES[phraseIndex]}</Label>
    </View>
  );
}

function AssistantBubble({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View style={{ alignSelf: 'flex-start', maxWidth: '85%', flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.xs }}>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Sparkles size={12} color={theme.colors.accent} strokeWidth={2} />
      </View>
      <View
        style={{
          backgroundColor: theme.colors.surfaceMuted,
          borderRadius: theme.radius.md,
          borderBottomLeftRadius: 4,
          padding: theme.spacing.sm + 2,
          flexShrink: 1,
        }}
      >
        <Body style={{ color: theme.colors.text, lineHeight: theme.lineHeight.base }}>{text}</Body>
      </View>
    </View>
  );
}

// Tapping a source jumps straight to that verse/chapter in its own reader — resolveSourceLink
// turns the chunk's `ref` (an internal "book|chapter|verse"-shaped string, format owned by
// database/searchIndex.ts) into an actual route. A chunk whose source type has no reader
// screen (shouldn't happen for the bible/egw/commentary set the AI Assistant searches, but
// resolveSourceLink returns null rather than throwing) is skipped rather than shown unpressable.
function SourceChips({ sources }: { sources: SearchChunk[] }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs, marginTop: theme.spacing.xs, marginLeft: 32 }}>
      {sources.map((s, i) => {
        const link = resolveSourceLink(s);
        if (!link) return null;
        return (
          <PressableScale key={i} scaleTo={0.95} onPress={() => router.push(link)}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.colors.accentSoft,
                borderRadius: theme.radius.pill,
                paddingHorizontal: theme.spacing.sm,
                paddingVertical: 4,
                gap: 4,
              }}
            >
              <Link2 size={10} color={theme.colors.accent} strokeWidth={2} />
              <Label style={{ color: theme.colors.accent, fontSize: 11 }} numberOfLines={1}>
                {s.title}
              </Label>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

export default function AIAssistantScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const db = useSQLiteContext();
  const [mode, setMode] = useState<AnswerMode>('offline');
  const [modelInfo, setModelInfo] = useState<ActiveModelInfo | null>(null);
  const [downloading, setDownloading] = useState(() => isDownloadingModel());
  const [importing, setImporting] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [popupRef, setPopupRef] = useState<VerseRef>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(() => getLastDownloadProgress());
  const [messages, setMessages] = useState<(ChatMessage & { at: number })[]>([{ ...GREETING, at: Date.now() }]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [indexingLabel, setIndexingLabel] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Restores the previous chat transcript instead of always starting fresh with just
  // the greeting — deliberately does NOT call resetConversation() here (unlike the
  // previous version). Also reconstructs the model's own follow-up memory
  // (restoreConversationHistory) from that same stored transcript: without this, the
  // visible log looked continuous after reopening the screen (or a full app restart)
  // but the model had no idea any of it happened — the very next message was silently
  // treated as the start of a brand new conversation instead of a real follow-up.
  useEffect(() => {
    loadChatHistory(db).then((stored) => {
      if (stored && stored.length > 0) {
        setMessages(stored);
        restoreConversationHistory(reconstructTurns(stored));
      }
      setHistoryLoaded(true);
    });
  }, [db]);

  // Guarded by historyLoaded so the initial greeting-only state (before we've even
  // checked kv) never overwrites real stored history with just the greeting.
  useEffect(() => {
    if (!historyLoaded) return;
    saveChatHistory(db, messages);
  }, [db, messages, historyLoaded]);

  const handleClearChat = useCallback(() => {
    resetConversation();
    setMessages([{ ...GREETING, at: Date.now() }]);
    clearChatHistory(db).catch(() => {});
    setSettingsVisible(false);
  }, [db]);

  const refreshModelInfo = useCallback(() => {
    getActiveModelInfo(db).then(setModelInfo);
  }, [db]);

  // Both the mode (offline/online) and which offline model is active are persisted —
  // load them once on mount rather than assuming offline/nothing-downloaded, so
  // reopening this screen respects whatever was chosen last time.
  useEffect(() => {
    getAnswerMode(db).then(setMode);
    refreshModelInfo();
  }, [db, refreshModelInfo]);

  // Loading the ~800MB model (initLlama) is itself a real, multi-second-plus cost —
  // previously it only started the moment the very first question was sent, landing
  // directly on top of that question's own prefill+generation time. Starting it here
  // instead, as soon as offline mode is selected and a model is actually ready, lets it
  // load in the background while the user is still reading the greeting or typing,
  // so by the time they hit send it's often already warm.
  useEffect(() => {
    if (mode === 'offline' && AI_INFERENCE_AVAILABLE && modelInfo?.ready && modelInfo.path) {
      warmContext(modelInfo.path);
    }
  }, [mode, modelInfo]);

  const handleSetMode = useCallback(
    (next: AnswerMode) => {
      setMode(next);
      setAnswerMode(db, next).catch(() => {});
    },
    [db]
  );

  // Indexing the app's content for search is a one-time cost (kept once built — see
  // ensureSearchIndexBuilt), but a real one: parsing every EGW book and commentary
  // volume takes a while on a phone. Running it here (as soon as the screen mounts,
  // regardless of offline/online mode — both modes retrieve excerpts the same way,
  // only which model writes the final answer differs) means it's usually already
  // done by the time someone finishes typing their first question, instead of
  // silently eating that first answer.
  useEffect(() => {
    let cancelled = false;
    ensureSearchIndexBuilt(db, (label) => {
      if (!cancelled) setIndexingLabel(label);
    })
      .catch((error) => {
        // This is a proactive background warm-up, not a user-initiated action — if it
        // fails (e.g. the db connection was torn down mid-build by a dev reload), there's
        // no UI to show an error in. askAssistant() calls ensureSearchIndexBuilt again on
        // the next real question and retries cleanly, so just log it instead of leaving
        // it an unhandled rejection (which otherwise surfaces as a scary uncaught error).
        if (!cancelled) console.error('Background search-index build failed', error);
      })
      .finally(() => {
        if (!cancelled) setIndexingLabel(null);
      });
    return () => {
      cancelled = true;
    };
  }, [db]);

  // KeyboardAvoidingView's automatic behaviors are unreliable on Android inside a
  // navigator screen (doubly so in Expo Go, where the manifest-level windowSoftInputMode
  // fix can't apply since it's not our own native build) — measuring the keyboard
  // directly and applying it as bottom padding sidesteps that entirely on both platforms.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      // headerTitleAlign is what actually centers this between the left and right edges —
      // Android's Stack default is left-aligned next to the back button, so without this
      // the title sits off-center regardless of how the component itself is styled.
      headerTitleAlign: 'center',
      headerTitle: () => (
        <View style={{ alignItems: 'center' }}>
          <Body style={{ fontFamily: theme.fontFamily.serifSemiBold, fontSize: theme.fontSize.md, textAlign: 'center' }}>
            Hello C
          </Body>
          <Label style={{ fontSize: 10, letterSpacing: 0.5, textAlign: 'center' }}>BIBLE ASSISTANT</Label>
        </View>
      ),
      headerRight: () => (
        <PressableScale onPress={() => setSettingsVisible(true)} style={{ padding: theme.spacing.xs }}>
          <Settings size={20} color={theme.colors.text} strokeWidth={1.75} />
        </PressableScale>
      ),
    });
  }, [navigation, theme]);

  useEffect(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [messages, sending, streamingText]);

  // downloadModel() now runs as a module-level singleton (see services/aiModel.ts) so it
  // keeps downloading in the background if this screen unmounts — e.g. the user switches to
  // another tab mid-download. If a download is already in flight when this screen (re)mounts,
  // this joins it (attaching setProgress as a listener) instead of leaving the UI stuck
  // showing the initial "Download" button while a download is silently still running.
  useEffect(() => {
    if (!isDownloadingModel()) return;
    let cancelled = false;
    downloadModel(setProgress)
      .then(async () => {
        if (cancelled) return;
        await setModelSource(db, 'download');
        refreshModelInfo();
      })
      .catch((error) => {
        if (!cancelled) showAlert('Download failed', describeDownloadError(error));
      })
      .finally(() => {
        if (!cancelled) setDownloading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadModel(setProgress);
      // Tapping this always makes the downloaded model the active source — if it's
      // already on disk (e.g. the user had switched to an imported model), this just
      // switches back near-instantly rather than actually re-downloading anything.
      await setModelSource(db, 'download');
      refreshModelInfo();
    } catch (error) {
      // downloadModel already cleans up a partial file — leave the model not-ready so
      // the button reappears for a retry. This used to fail completely silently (no
      // message at all, indistinguishable from the button just not working) and then
      // showed the raw native exception text — describeDownloadError maps the common
      // cases (no connection, timeout) to plain language instead.
      showAlert('Download failed', describeDownloadError(error));
    } finally {
      setDownloading(false);
    }
  };

  const handleUseImported = () => {
    setModelSource(db, 'import')
      .then(refreshModelInfo)
      .catch(() => {});
  };

  const handleImport = async () => {
    try {
      // GGUF has no registered MIME type, so this can't usefully filter by type —
      // importModel() rejects anything whose filename doesn't end in .gguf instead.
      const picked = await File.pickFileAsync();
      if (picked.canceled) return;
      setImporting(true);
      await importModel(db, picked.result);
      refreshModelInfo();
    } catch (error) {
      showAlert('Import failed', error instanceof Error ? error.message : "Couldn't import that file.");
    } finally {
      setImporting(false);
    }
  };

  const handleSend = async () => {
    const question = input.trim();
    if (!question || sending) return;
    setInput('');
    setMessages((prev) => [...prev, { id: newLocalId(), role: 'user', text: question, at: Date.now() }]);
    setSending(true);
    setStreamingText('');
    try {
      await askAssistant(question, db, {
        onToken: setStreamingText,
        onSection: (sectionText, sources) => {
          // A long answer arrives as more than one section — each finished one becomes
          // its own message immediately, and streaming resets for whatever comes next.
          setMessages((prev) => [...prev, { id: newLocalId(), role: 'assistant', text: sectionText, sources, at: Date.now() }]);
          setStreamingText('');
        },
      });
    } catch (error) {
      // Without this, a native-module failure (OOM loading the ~800MB model, a search
      // index error, etc.) would leave `sending` stuck true forever — the input never
      // re-enables until the app restarts.
      console.error('AI assistant failed', error);
      setMessages((prev) => [
        ...prev,
        { id: newLocalId(), role: 'assistant', text: 'Something went wrong answering that. Please try again.', at: Date.now() },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <View style={{ flex: 1, paddingBottom: keyboardHeight }}>
        {mode === 'offline' && !modelInfo?.ready && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              backgroundColor: theme.colors.accentSoft,
              padding: theme.spacing.sm + 2,
              margin: theme.spacing.lg,
              marginBottom: 0,
              borderRadius: theme.radius.md,
            }}
          >
            <Settings size={16} color={theme.colors.accent} strokeWidth={1.75} style={{ marginTop: 2 }} />
            <Body style={{ flex: 1, marginLeft: theme.spacing.xs, fontSize: theme.fontSize.sm, color: theme.colors.onAccent }}>
              {AI_INFERENCE_AVAILABLE
                ? 'Set up the offline AI model in Settings (gear icon above) to get started.'
                : "Offline answers need a development build. You can still set up the model in Settings now so it's ready the moment that build exists."}
            </Body>
          </View>
        )}

        {mode === 'online' && !GROQ_AVAILABLE && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              backgroundColor: theme.colors.accentSoft,
              padding: theme.spacing.sm + 2,
              margin: theme.spacing.lg,
              marginBottom: 0,
              borderRadius: theme.radius.md,
            }}
          >
            <Settings size={16} color={theme.colors.accent} strokeWidth={1.75} style={{ marginTop: 2 }} />
            <Body style={{ flex: 1, marginLeft: theme.spacing.xs, fontSize: theme.fontSize.sm, color: theme.colors.onAccent }}>
              Online mode isn't configured yet. Switch to Offline in Settings (gear icon above), or ask again once it's set up.
            </Body>
          </View>
        )}

        {mode === 'offline' && modelInfo?.ready && indexingLabel && (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm }}>
            <Label style={{ color: theme.colors.textMuted, flex: 1 }} numberOfLines={1}>
              Preparing offline content… {indexingLabel}
            </Label>
          </View>
        )}

        <FlatList
          ref={listRef}
          style={{ flex: 1 }}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={sending ? streamingText ? <AssistantBubble text={streamingText} /> : <ThinkingBubble /> : null}
          ListFooterComponentStyle={{ marginTop: theme.spacing.sm }}
          renderItem={({ item }) => (
            <View style={{ alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-end',
                  gap: theme.spacing.xs,
                }}
              >
                {item.role === 'assistant' && (
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: theme.radius.pill,
                      backgroundColor: theme.colors.accentSoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Sparkles size={12} color={theme.colors.accent} strokeWidth={2} />
                  </View>
                )}
                <View
                  style={{
                    backgroundColor: item.role === 'user' ? theme.colors.primary : theme.colors.surfaceMuted,
                    borderRadius: theme.radius.md,
                    borderBottomRightRadius: item.role === 'user' ? 4 : theme.radius.md,
                    borderBottomLeftRadius: item.role === 'assistant' ? 4 : theme.radius.md,
                    padding: theme.spacing.sm + 2,
                    flexShrink: 1,
                  }}
                >
                  <Body style={{ color: item.role === 'user' ? theme.colors.onPrimary : theme.colors.text, lineHeight: theme.lineHeight.base }}>
                    {item.role === 'assistant' ? renderMessageText(item.text, theme.colors.primary, setPopupRef) : item.text}
                  </Body>
                </View>
              </View>
              {item.role === 'assistant' && item.sources && item.sources.length > 0 && (
                <SourceChips sources={item.sources} />
              )}
              <Label
                style={{
                  marginTop: 2,
                  textAlign: item.role === 'user' ? 'right' : 'left',
                  marginLeft: item.role === 'assistant' ? 32 : 0,
                }}
              >
                {formatTime(new Date(item.at))}
              </Label>
            </View>
          )}
        />

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: theme.spacing.lg,
            paddingTop: theme.spacing.sm,
            gap: theme.spacing.sm,
          }}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask a question…"
            placeholderTextColor={theme.colors.textFaint}
            multiline
            style={{
              flex: 1,
              maxHeight: 100,
              backgroundColor: theme.colors.surfaceMuted,
              borderRadius: theme.radius.md,
              paddingHorizontal: theme.spacing.sm + 2,
              paddingVertical: theme.spacing.sm,
              color: theme.colors.text,
              fontFamily: theme.fontFamily.sansRegular,
              fontSize: theme.fontSize.base,
            }}
          />
          <PressableScale onPress={handleSend} disabled={!input.trim() || sending} scaleTo={0.9}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: !input.trim() || sending ? 0.5 : 1,
              }}
            >
              <ArrowUp size={18} color={theme.colors.onPrimary} strokeWidth={2.25} />
            </View>
          </PressableScale>
        </View>
      </View>

      <AISettingsSheet
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        mode={mode}
        onSelectMode={handleSetMode}
        groqAvailable={GROQ_AVAILABLE}
        aiInferenceAvailable={AI_INFERENCE_AVAILABLE}
        modelInfo={modelInfo}
        hasDownloadedModel={hasModel()}
        hasImportedModelFile={hasImportedModel()}
        downloading={downloading}
        importing={importing}
        progress={progress}
        onDownload={handleDownload}
        onImport={handleImport}
        onUseImported={handleUseImported}
        onClearChat={handleClearChat}
      />
      <VersePopup reference={popupRef} onClose={() => setPopupRef(null)} />
    </SafeAreaView>
  );
}
