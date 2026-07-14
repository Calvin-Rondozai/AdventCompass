import React, { useState } from 'react';
import { TextInput, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Body } from '@/components/ui/Typography';

const LINE_HEIGHT = 28;
const MIN_LINES = 3;

// The "write your thoughts" card style from the reference screenshot: the question up
// top (its scripture reference tappable/underlined), ruled notebook lines underneath
// that grow as the answer grows.
export function DiscussionQuestionCard({
  question,
  answer,
  onChangeAnswer,
}: {
  question: React.ReactNode;
  answer: string;
  onChangeAnswer: (text: string) => void;
}) {
  const theme = useTheme();
  const [height, setHeight] = useState(MIN_LINES * LINE_HEIGHT);
  const lineCount = Math.max(MIN_LINES, Math.ceil(height / LINE_HEIGHT) + 1);

  return (
    <View
      style={{
        backgroundColor: theme.colors.surfaceMuted,
        borderRadius: theme.radius.lg,
        padding: theme.spacing.md,
        marginBottom: theme.spacing.md,
      }}
    >
      <Body style={{ fontFamily: theme.fontFamily.sansSemiBold, fontSize: theme.fontSize.base, lineHeight: theme.lineHeight.base }}>
        {question}
      </Body>
      <View style={{ marginTop: theme.spacing.sm }}>
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: Math.max(height, MIN_LINES * LINE_HEIGHT) }}>
          {Array.from({ length: lineCount }, (_, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: (i + 1) * LINE_HEIGHT - 1,
                height: 1,
                backgroundColor: theme.colors.border,
              }}
            />
          ))}
        </View>
        <TextInput
          value={answer}
          onChangeText={onChangeAnswer}
          onContentSizeChange={(e) => setHeight(e.nativeEvent.contentSize.height)}
          placeholder="Write your thoughts…"
          placeholderTextColor={theme.colors.textFaint}
          multiline
          textAlignVertical="top"
          style={{
            minHeight: MIN_LINES * LINE_HEIGHT,
            fontFamily: theme.fontFamily.sansRegular,
            fontSize: theme.fontSize.base,
            lineHeight: LINE_HEIGHT,
            color: theme.colors.text,
          }}
        />
      </View>
    </View>
  );
}
