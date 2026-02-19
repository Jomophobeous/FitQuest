/**
 * SimpleMarkdown — Lightweight inline markdown renderer for chat messages
 * 
 * Supports: **bold**, *italic*, \n (newlines), numbered lists, bullet lists
 * Does NOT use any external markdown libraries — pure RN Text components.
 */

import React from 'react';
import { Text, StyleSheet, type TextStyle, type StyleProp } from 'react-native';

interface SimpleMarkdownProps {
  text: string;
  style?: StyleProp<TextStyle>;
  boldStyle?: TextStyle;
  italicStyle?: TextStyle;
}

interface TextSegment {
  text: string;
  bold: boolean;
  italic: boolean;
}

/**
 * Parse a single line into segments with bold/italic flags
 */
function parseInlineFormatting(line: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let remaining = line;

  while (remaining.length > 0) {
    // Look for **bold** first (greedy but not across newlines)
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Look for *italic* (single asterisk, not double)
    const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/);

    let nextMatch: { index: number; length: number; content: string; type: 'bold' | 'italic' } | null = null;

    if (boldMatch && boldMatch.index !== undefined) {
      nextMatch = {
        index: boldMatch.index,
        length: boldMatch[0].length,
        content: boldMatch[1],
        type: 'bold',
      };
    }

    if (italicMatch && italicMatch.index !== undefined) {
      if (!nextMatch || italicMatch.index < nextMatch.index) {
        nextMatch = {
          index: italicMatch.index,
          length: italicMatch[0].length,
          content: italicMatch[1],
          type: 'italic',
        };
      }
    }

    if (!nextMatch) {
      // No more formatting — push remaining text
      if (remaining) {
        segments.push({ text: remaining, bold: false, italic: false });
      }
      break;
    }

    // Push text before the match
    if (nextMatch.index > 0) {
      segments.push({
        text: remaining.substring(0, nextMatch.index),
        bold: false,
        italic: false,
      });
    }

    // Push the formatted segment
    segments.push({
      text: nextMatch.content,
      bold: nextMatch.type === 'bold',
      italic: nextMatch.type === 'italic',
    });

    remaining = remaining.substring(nextMatch.index + nextMatch.length);
  }

  return segments;
}

/**
 * Render a text string with basic markdown formatting
 */
export default function SimpleMarkdown({ text, style, boldStyle, italicStyle }: SimpleMarkdownProps) {
  const lines = text.split('\n');

  return (
    <Text style={style}>
      {lines.map((line, lineIdx) => {
        const segments = parseInlineFormatting(line);
        return (
          <React.Fragment key={lineIdx}>
            {lineIdx > 0 && '\n'}
            {segments.map((seg, segIdx) => {
              if (seg.bold) {
                return (
                  <Text key={segIdx} style={[{ fontWeight: '700' }, boldStyle]}>
                    {seg.text}
                  </Text>
                );
              }
              if (seg.italic) {
                return (
                  <Text key={segIdx} style={[{ fontStyle: 'italic' }, italicStyle]}>
                    {seg.text}
                  </Text>
                );
              }
              return <React.Fragment key={segIdx}>{seg.text}</React.Fragment>;
            })}
          </React.Fragment>
        );
      })}
    </Text>
  );
}
