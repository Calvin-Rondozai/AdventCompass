import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FlatList, Keyboard, Platform, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { MotiView } from 'moti';
import { Info, Sparkles, Download, ArrowUp } from '@/components/ui/Icon';

import { useTheme } from '@/theme/ThemeProvider';
import { downloadModel, hasModel, DownloadProgress } from '@/services/aiModel';
import { AI_INFERENCE_AVAILABLE, askAssistant, ChatMessage, resetConversation } from '@/services/aiAssistant';
import { ensureSearchIndexBuilt } from '@/database/searchIndex';
import { PressableScale } from '@/components/ui/PressableScale';
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

// Cycled while waiting for the model's first token (prompt prefill on a 1B model can
// take a few real seconds) — a plain three-dot bubble that never changes reads as
// "frozen" past a couple of seconds, so the label rotates to keep it legible as progress.
const THINKING_PHRASES = ['Thinking…', 'Searching the Bible, EGW & Commentary…', 'Putting it together…'];

function ThinkingBubble() {
  const theme = useTheme();
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex((i) => (i + 1) % THINKING_PHRASES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

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
        {[0, 1, 2].map((i) => (
          <MotiView
            key={i}
            from={{ opacity: 0.3, translateY: 0 }}
            animate={{ opacity: 1, translateY: -3 }}
            transition={{ type: 'timing', duration: 350, loop: true, repeatReverse: true, delay: i * 120 }}
            style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.textFaint }}
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

export default function AIAssistantScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const db = useSQLiteContext();
  const [modelReady, setModelReady] = useState(() => hasModel());
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [messages, setMessages] = useState<(ChatMessage & { at: number })[]>([{ ...GREETING, at: Date.now() }]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [indexingLabel, setIndexingLabel] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // The visible chat log below always starts fresh on mount (just the greeting) — reset
  // the model's conversation memory to match, so reopening this screen doesn't silently
  // carry over context from a chat the user can no longer see.
  useEffect(() => {
    resetConversation();
  }, []);

  // Indexing the app's content for search is a one-time cost (kept once built — see
  // ensureSearchIndexBuilt), but a real one: parsing every EGW book and commentary
  // volume takes a while on a phone. Running it here — right after the model is ready,
  // with its own status line — means it's usually already done by the time someone
  // finishes typing their first question, instead of silently eating that first answer.
  useEffect(() => {
    if (!modelReady || !AI_INFERENCE_AVAILABLE) return;
    let cancelled = false;
    ensureSearchIndexBuilt(db, (label) => {
      if (!cancelled) setIndexingLabel(label);
    }).finally(() => {
      if (!cancelled) setIndexingLabel(null);
    });
    return () => {
      cancelled = true;
    };
  }, [modelReady, db]);

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
    });
  }, [navigation, theme]);

  useEffect(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [messages, sending, streamingText]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadModel(setProgress);
      setModelReady(true);
    } catch {
      // downloadModel already cleans up a partial file — leave modelReady false so the
      // button reappears for a retry.
    } finally {
      setDownloading(false);
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
        onSection: (sectionText) => {
          // A long answer arrives as more than one section — each finished one becomes
          // its own message immediately, and streaming resets for whatever comes next.
          setMessages((prev) => [...prev, { id: newLocalId(), role: 'assistant', text: sectionText, at: Date.now() }]);
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
        {!AI_INFERENCE_AVAILABLE && (
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
            <Info size={16} color={theme.colors.accent} strokeWidth={1.75} style={{ marginTop: 2 }} />
            <Body style={{ flex: 1, marginLeft: theme.spacing.xs, fontSize: theme.fontSize.sm, color: theme.colors.onAccent }}>
              {modelReady
                ? "Model downloaded and ready. This banner stays until you're running a development build. Expo Go can't load the on-device model at all. Run npx expo prebuild then npx expo run:android (or run:ios) to install one."
                : "Live answers need a development build (an on-device model, no internet at chat time). You can download the model now so it's ready the moment that build exists."}
            </Body>
          </View>
        )}

        {!modelReady && (
          <View style={{ padding: theme.spacing.lg }}>
            <PressableScale onPress={handleDownload} scaleTo={0.98} disabled={downloading}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.colors.primary,
                  borderRadius: theme.radius.md,
                  padding: theme.spacing.sm + 2,
                  opacity: downloading ? 0.7 : 1,
                }}
              >
                <Download size={16} color={theme.colors.onPrimary} strokeWidth={2} />
                <Body style={{ color: theme.colors.onPrimary, fontFamily: theme.fontFamily.sansSemiBold, marginLeft: theme.spacing.xs }}>
                  {downloading ? 'Downloading model…' : 'Download AI model (~800 MB)'}
                </Body>
              </View>
            </PressableScale>
            {downloading && progress && progress.totalBytes > 0 && (
              <View style={{ marginTop: theme.spacing.sm }}>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.colors.surfaceMuted, overflow: 'hidden' }}>
                  <View
                    style={{
                      height: '100%',
                      width: `${Math.min(100, (progress.bytesWritten / progress.totalBytes) * 100)}%`,
                      backgroundColor: theme.colors.primary,
                    }}
                  />
                </View>
                <Label style={{ marginTop: 4, textAlign: 'center' }}>
                  {formatBytes(progress.bytesWritten)} / {formatBytes(progress.totalBytes)}
                </Label>
              </View>
            )}
          </View>
        )}

        {modelReady && indexingLabel && (
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
                    {item.text}
                  </Body>
                </View>
              </View>
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
    </SafeAreaView>
  );
}
