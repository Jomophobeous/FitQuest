/**
 * FQ Logo Mark — Premium interconnected abstract line system.
 *
 * "F" and "Q" constructed from a unified geometric line network.
 * Ultra-clean vector, sharp controlled line work, futuristic & minimal.
 * Designed for dark backgrounds with neon green (#00FF99) accents.
 */
import React from 'react';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Path,
  Circle,
  Line,
  G,
  Rect,
  RadialGradient,
} from 'react-native-svg';

interface Props {
  /** Rendered width/height in dp (square) */
  size?: number;
  /** Show subtle glow halo behind the mark */
  showGlow?: boolean;
  /** Variant: 'full' (F+Q), 'icon' (compact for app icon) */
  variant?: 'full' | 'icon';
}

export default function FQLogoMark({ size = 80, showGlow = true, variant = 'full' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512">
      <Defs>
        {/* Primary accent gradient — neon green */}
        <LinearGradient id="fqAccent" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#00FF99" />
          <Stop offset="100%" stopColor="#10B981" />
        </LinearGradient>

        {/* Secondary: faint cyan for depth lines */}
        <LinearGradient id="fqCyan" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#06B6D4" stopOpacity={0.3} />
          <Stop offset="100%" stopColor="#22D3EE" stopOpacity={0.15} />
        </LinearGradient>

        {/* Glow radial behind the mark */}
        <RadialGradient id="fqGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#00FF99" stopOpacity={0.12} />
          <Stop offset="60%" stopColor="#00FF99" stopOpacity={0.04} />
          <Stop offset="100%" stopColor="#00FF99" stopOpacity={0} />
        </RadialGradient>

        {/* Subtle background fill */}
        <RadialGradient id="fqBg" cx="50%" cy="45%" r="55%">
          <Stop offset="0%" stopColor="#0D1117" />
          <Stop offset="100%" stopColor="#060609" />
        </RadialGradient>
      </Defs>

      {/* Background — near-black */}
      <Rect width="512" height="512" rx="96" fill="url(#fqBg)" />

      {/* Ambient glow */}
      {showGlow && <Circle cx="256" cy="256" r="200" fill="url(#fqGlow)" />}

      {/* ─── Depth lines (faint cyan grid) ─── */}
      <G opacity={0.15}>
        <Line x1="100" y1="160" x2="412" y2="160" stroke="#22D3EE" strokeWidth="1" />
        <Line x1="100" y1="256" x2="412" y2="256" stroke="#22D3EE" strokeWidth="1" />
        <Line x1="100" y1="352" x2="412" y2="352" stroke="#22D3EE" strokeWidth="1" />
      </G>

      {/*
        ─── THE FQ SYSTEM ───
        Both letters share a unified vertical spine.
        F: left side — vertical spine + two horizontal arms (top + middle).
        Q: right side — circular arc connected to the spine, with diagonal tail.
        The letters merge at the spine — they are one system.
      */}

      <G>
        {/* ═══ SHARED VERTICAL SPINE ═══
            The backbone: runs from top to bottom, shared by F and Q.
            F attaches its horizontals; Q's arc connects at top and bottom. */}
        <Line
          x1="160"
          y1="120"
          x2="160"
          y2="392"
          stroke="url(#fqAccent)"
          strokeWidth="10"
          strokeLinecap="round"
        />

        {/* ═══ F — TOP HORIZONTAL ARM ═══
            Sharp extension from spine top, rightward */}
        <Line
          x1="160"
          y1="120"
          x2="280"
          y2="120"
          stroke="url(#fqAccent)"
          strokeWidth="10"
          strokeLinecap="round"
        />

        {/* ═══ F — MIDDLE HORIZONTAL ARM ═══
            Shorter arm at vertical midpoint — links into Q's arc */}
        <Line
          x1="160"
          y1="240"
          x2="260"
          y2="240"
          stroke="url(#fqAccent)"
          strokeWidth="10"
          strokeLinecap="round"
        />

        {/* ═══ LINKAGE: F-arm → Q-arc ═══
            A diagonal connector bridges the F middle arm to the Q circle.
            This is the key "interconnection" — the system becomes one. */}
        <Line
          x1="260"
          y1="240"
          x2="290"
          y2="200"
          stroke="url(#fqAccent)"
          strokeWidth="8"
          strokeLinecap="round"
        />

        {/* ═══ Q — CIRCULAR ARC ═══
            Semi-circular/full arc on the right side.
            Starts from near the F's top arm, sweeps down and back. */}
        <Path
          d="M 290 160
             C 370 160, 400 210, 400 270
             C 400 340, 360 380, 290 380
             L 160 392"
          fill="none"
          stroke="url(#fqAccent)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* ═══ Q — Connection: top of arc to F top arm ═══ */}
        <Line
          x1="280"
          y1="120"
          x2="290"
          y2="160"
          stroke="url(#fqAccent)"
          strokeWidth="8"
          strokeLinecap="round"
        />

        {/* ═══ Q — TAIL ═══
            The signature Q tail — emerges diagonally from the bottom-right
            of the arc. Sharp, decisive, forward-leaning. */}
        <Line
          x1="360"
          y1="340"
          x2="420"
          y2="410"
          stroke="url(#fqAccent)"
          strokeWidth="10"
          strokeLinecap="round"
        />

        {/* ═══ ACCENT NODES ═══
            Small circles at key junction points — geometric precision. */}
        <Circle cx="160" cy="120" r="6" fill="#00FF99" />
        <Circle cx="280" cy="120" r="5" fill="#00FF99" opacity={0.8} />
        <Circle cx="160" cy="240" r="5" fill="#00FF99" opacity={0.7} />
        <Circle cx="260" cy="240" r="5" fill="#00FF99" opacity={0.7} />
        <Circle cx="160" cy="392" r="6" fill="#00FF99" />
        <Circle cx="420" cy="410" r="6" fill="#00FF99" />

        {/* ═══ FAINT STRUCTURE LINES ═══
            Ghost lines showing the underlying geometric grid — engineered feel */}
        <Line
          x1="290"
          y1="160"
          x2="290"
          y2="380"
          stroke="#00FF99"
          strokeWidth="1"
          strokeDasharray="4,8"
          opacity={0.15}
        />
        <Line
          x1="160"
          y1="392"
          x2="420"
          y2="392"
          stroke="#00FF99"
          strokeWidth="1"
          strokeDasharray="4,8"
          opacity={0.1}
        />
      </G>
    </Svg>
  );
}
