import React, { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { findScriptureRefs } from '@/database/scriptureRefs';
import { Body } from '@/components/ui/Typography';
import type { VerseRef } from '@/components/bible/VersePopup';

type TableBlock = { type: 'table'; header: string[]; rows: string[][] };
type TextBlock = { type: 'text'; text: string };
type Block = TableBlock | TextBlock;

// Neither the offline (llama.rn) nor online (Groq) model is told to use markdown, but
// both fall into it anyway for comparisons and emphasis — this used to render as literal
// asterisks and pipe characters. Only **bold** and GFM-style tables are worth handling;
// small/offline models don't reliably close italics or nested markup.
function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.includes('|') && trimmed.length > 0;
}

function isSeparatorRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.length > 0 && /^[\s|:-]+$/.test(trimmed) && trimmed.includes('-');
}

function splitCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

function splitBlocks(text: string): Block[] {
  const lines = text.split('\n');
  const blocks: Block[] = [];
  let buffer: string[] = [];

  const flushBuffer = () => {
    const joined = buffer.join('\n').trim();
    if (joined) blocks.push({ type: 'text', text: joined });
    buffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isTableRow(line) && i + 1 < lines.length && isSeparatorRow(lines[i + 1])) {
      flushBuffer();
      const header = splitCells(line);
      let j = i + 2;
      const rows: string[][] = [];
      while (j < lines.length && isTableRow(lines[j]) && !isSeparatorRow(lines[j])) {
        rows.push(splitCells(lines[j]));
        j++;
      }
      blocks.push({ type: 'table', header, rows });
      i = j - 1;
    } else {
      buffer.push(line);
    }
  }
  flushBuffer();
  return blocks;
}

// Splits **bold** spans out of a plain-text run.
function splitBold(text: string): { text: string; bold: boolean }[] {
  const parts: { text: string; bold: boolean }[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > cursor) parts.push({ text: text.slice(cursor, m.index), bold: false });
    parts.push({ text: m[1], bold: true });
    cursor = m.index + m[0].length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), bold: false });
  return parts;
}

// Renders one line's worth of inline content as children of a single parent <Body> —
// nested <Text> spans lay out inline (unlike sibling Views), which is what lets a bold
// word or a tappable verse reference sit mid-sentence instead of breaking to its own line.
function renderInlineChildren(
  text: string,
  keyPrefix: string,
  boldFamily: string,
  linkColor?: string,
  onPressRef?: (ref: VerseRef) => void
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  splitBold(text).forEach((part, pi) => {
    const boldStyle = part.bold ? { fontFamily: boldFamily } : undefined;
    const refs = onPressRef && linkColor ? findScriptureRefs(part.text) : [];

    if (refs.length === 0) {
      nodes.push(boldStyle ? <Text key={`${keyPrefix}-${pi}`} style={boldStyle}>{part.text}</Text> : part.text);
      return;
    }

    let cursor = 0;
    refs.forEach((ref, ri) => {
      if (ref.start > cursor) {
        const pre = part.text.slice(cursor, ref.start);
        nodes.push(boldStyle ? <Text key={`${keyPrefix}-${pi}-${ri}-pre`} style={boldStyle}>{pre}</Text> : pre);
      }
      nodes.push(
        <Text
          key={`${keyPrefix}-${pi}-${ri}`}
          style={[boldStyle, { color: linkColor, textDecorationLine: 'underline' }]}
          onPress={() => onPressRef!({ book: ref.book, chapter: ref.chapter, verse: ref.verse, verseEnd: ref.verseEnd })}
        >
          {ref.text}
        </Text>
      );
      cursor = ref.end;
    });
    if (cursor < part.text.length) {
      const tail = part.text.slice(cursor);
      nodes.push(boldStyle ? <Text key={`${keyPrefix}-${pi}-tail`} style={boldStyle}>{tail}</Text> : tail);
    }
  });
  return nodes;
}

function MarkdownTable({ header, rows }: { header: string[]; rows: string[][] }) {
  const theme = useTheme();
  const columns = header.length;
  const cellStyle = (ci: number) => ({
    minWidth: 90,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRightWidth: ci < columns - 1 ? 1 : 0,
    borderRightColor: theme.colors.border,
  });

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: theme.spacing.xs }}>
      <View style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.sm, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', backgroundColor: theme.colors.accentSoft }}>
          {header.map((cell, ci) => (
            <View key={ci} style={cellStyle(ci)}>
              <Body style={{ fontFamily: theme.fontFamily.sansBold, fontSize: theme.fontSize.sm, color: theme.colors.text }}>
                {renderInlineChildren(cell, `h-${ci}`, theme.fontFamily.sansBold)}
              </Body>
            </View>
          ))}
        </View>
        {rows.map((row, ri) => (
          <View
            key={ri}
            style={{
              flexDirection: 'row',
              borderTopWidth: 1,
              borderTopColor: theme.colors.border,
              backgroundColor: ri % 2 === 1 ? theme.colors.surfaceMuted : 'transparent',
            }}
          >
            {Array.from({ length: columns }).map((_, ci) => (
              <View key={ci} style={cellStyle(ci)}>
                <Body style={{ fontSize: theme.fontSize.sm, color: theme.colors.text }}>
                  {renderInlineChildren(row[ci] ?? '', `r${ri}-${ci}`, theme.fontFamily.sansBold)}
                </Body>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

type Props = {
  text: string;
  textColor: string;
  linkColor?: string;
  onPressRef?: (ref: VerseRef) => void;
};

// Drop-in replacement for a plain <Body>{text}</Body> in an assistant chat bubble —
// renders **bold** spans, GFM-style tables, and (when linkColor/onPressRef are given)
// tappable scripture references, instead of showing the model's raw markdown syntax.
export function FormattedMessage({ text, textColor, linkColor, onPressRef }: Props) {
  const theme = useTheme();
  const blocks = useMemo(() => splitBlocks(text), [text]);

  return (
    <View style={{ gap: theme.spacing.xs }}>
      {blocks.map((block, bi) => {
        if (block.type === 'table') {
          return <MarkdownTable key={bi} header={block.header} rows={block.rows} />;
        }
        return block.text.split('\n').map((line, li) => (
          <Body key={`${bi}-${li}`} style={{ color: textColor, lineHeight: theme.lineHeight.base }}>
            {line.trim() === ''
              ? ' '
              : renderInlineChildren(line, `${bi}-${li}`, theme.fontFamily.sansBold, linkColor, onPressRef)}
          </Body>
        ));
      })}
    </View>
  );
}
