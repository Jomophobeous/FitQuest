/**
 * SimpleMarkdown — Lightweight inline markdown renderer for chat messages
 *
 * Supports: **bold**, *italic*, \n, headers (# ## ###), bullet lists (- *),
 * numbered lists (1. 2.), inline code (`code`). Pure RN Text components.
 */

import React from 'react';
import { Text, View, StyleSheet, Platform, type TextStyle, type StyleProp } from 'react-native';

interface SimpleMarkdownProps {
  text: string;
  style?: StyleProp<TextStyle>;
  boldStyle?: TextStyle;
  italicStyle?: TextStyle;
  accentColor?: string;
}

interface TextSegment {
  text: string;
  bold: boolean;
  italic: boolean;
  code: boolean;
}

type LineType = 'text' | 'h1' | 'h2' | 'h3' | 'bullet' | 'numbered';

interface ParsedLine {
  type: LineType;
  content: string;
  number?: number;
}

/**
 * Classify a line as heading, bullet, numbered list, or plain text
 */
function classifyLine(line: string): ParsedLine {
  // Headers: ### > ## > #
  const h3Match = line.match(/^###\s+(.+)/);
  if (h3Match) return { type: 'h3', content: h3Match[1]! };

  const h2Match = line.match(/^##\s+(.+)/);
  if (h2Match) return { type: 'h2', content: h2Match[1]! };

  const h1Match = line.match(/^#\s+(.+)/);
  if (h1Match) return { type: 'h1', content: h1Match[1]! };

  // Bullet lists: - item or * item
  const bulletMatch = line.match(/^[\-\*]\s+(.+)/);
  if (bulletMatch) return { type: 'bullet', content: bulletMatch[1]! };

  // Numbered lists: 1. item, 2. item
  const numMatch = line.match(/^(\d+)\.\s+(.+)/);
  if (numMatch) return { type: 'numbered', content: numMatch[2]!, number: parseInt(numMatch[1]!, 10) };

  return { type: 'text', content: line };
}

/**
 * Parse a single line into segments with bold/italic/code flags
 */
function parseInlineFormatting(line: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let remaining = line;

  while (remaining.length > 0) {
    // Look for `code` (backticks)
    const codeMatch = remaining.match(/`([^`]+)`/);
    // Look for **bold** first (greedy but not across newlines)
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Look for *italic* (single asterisk, not double)
    const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/);

    let nextMatch: { index: number; length: number; content: string; type: 'bold' | 'italic' | 'code' } | null = null;

    if (codeMatch && codeMatch.index !== undefined) {
      nextMatch = { index: codeMatch.index, length: codeMatch[0].length, content: codeMatch[1]!, type: 'code' };
    }

    if (boldMatch && boldMatch.index !== undefined) {
      if (!nextMatch || boldMatch.index < nextMatch.index) {
        nextMatch = { index: boldMatch.index, length: boldMatch[0].length, content: boldMatch[1]!, type: 'bold' };
      }
    }

    if (italicMatch && italicMatch.index !== undefined) {
      if (!nextMatch || italicMatch.index < nextMatch.index) {
        nextMatch = {
          index: italicMatch.index,
          length: italicMatch[0].length,
          content: italicMatch[1]!,
          type: 'italic',
        };
      }
    }

    if (!nextMatch) {
      if (remaining) segments.push({ text: remaining, bold: false, italic: false, code: false });
      break;
    }

    if (nextMatch.index > 0) {
      segments.push({ text: remaining.substring(0, nextMatch.index), bold: false, italic: false, code: false });
    }

    segments.push({
      text: nextMatch.content,
      bold: nextMatch.type === 'bold',
      italic: nextMatch.type === 'italic',
      code: nextMatch.type === 'code',
    });

    remaining = remaining.substring(nextMatch.index + nextMatch.length);
  }

  return segments;
}

function renderSegments(segments: TextSegment[], boldStyle?: TextStyle, italicStyle?: TextStyle, accentColor?: string) {
  return segments.map((seg, idx) => {
    if (seg.bold) {
      return (
        <Text key={idx} style={[{ fontWeight: '700' }, boldStyle]}>
          {seg.text}
        </Text>
      );
    }
    if (seg.italic) {
      return (
        <Text key={idx} style={[{ fontStyle: 'italic' }, italicStyle]}>
          {seg.text}
        </Text>
      );
    }
    if (seg.code) {
      return (
        <Text key={idx} style={[mdStyles.code, accentColor ? { color: accentColor } : undefined]}>
          {seg.text}
        </Text>
      );
    }
    return <React.Fragment key={idx}>{seg.text}</React.Fragment>;
  });
}

/**
 * Render a text string with markdown formatting
 */
export default function SimpleMarkdown({ text, style, boldStyle, italicStyle, accentColor }: SimpleMarkdownProps) {
  const lines = text.split('\n');
  const parsed = lines.map(classifyLine);

  return (
    <View style={{ flexShrink: 1 }}>
      {parsed.map((line, lineIdx) => {
        const segments = parseInlineFormatting(line.content);
        const rendered = renderSegments(segments, boldStyle, italicStyle, accentColor);

        switch (line.type) {
          case 'h1':
            return (
              <Text key={lineIdx} style={[style, mdStyles.h1, boldStyle]}>
                {rendered}
              </Text>
            );
          case 'h2':
            return (
              <Text key={lineIdx} style={[style, mdStyles.h2, boldStyle]}>
                {rendered}
              </Text>
            );
          case 'h3':
            return (
              <Text key={lineIdx} style={[style, mdStyles.h3, boldStyle]}>
                {rendered}
              </Text>
            );
          case 'bullet':
            return (
              <View key={lineIdx} style={mdStyles.listRow}>
                <Text style={[style, mdStyles.bullet, accentColor ? { color: accentColor } : undefined]}>
                  {'  \u2022  '}
                </Text>
                <Text style={[style, mdStyles.listText]}>{rendered}</Text>
              </View>
            );
          case 'numbered':
            return (
              <View key={lineIdx} style={mdStyles.listRow}>
                <Text
                  style={[style, mdStyles.number, accentColor ? { color: accentColor } : undefined]}
                >{`  ${line.number}.  `}</Text>
                <Text style={[style, mdStyles.listText]}>{rendered}</Text>
              </View>
            );
          default:
            // Empty line = spacing
            if (!line.content.trim()) {
              return <View key={lineIdx} style={{ height: 6 }} />;
            }
            return (
              <Text key={lineIdx} style={style}>
                {rendered}
              </Text>
            );
        }
      })}
    </View>
  );
}

const mdStyles = StyleSheet.create({
  h1: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 4,
    lineHeight: 24,
  },
  h2: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 3,
    lineHeight: 22,
  },
  h3: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 2,
    lineHeight: 21,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 1,
  },
  bullet: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
  },
  number: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    minWidth: 30,
  },
  listText: {
    flex: 1,
    fontSize: 14.5,
    lineHeight: 21,
  },
  code: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.3,
  },
});
