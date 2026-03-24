/**
 * FitQuest Logo — SVG shield with running figure.
 * Replaces generic MaterialCommunityIcons across splash, login, dashboard.
 */
import React from 'react';
import Svg, { Defs, LinearGradient, Stop, Rect, Ellipse, Path, Circle, Line, Text as SvgText } from 'react-native-svg';

interface Props {
  /** Rendered width/height in dp (square) */
  size?: number;
  /** Show "FQ" text at bottom of shield */
  showText?: boolean;
}

export default function FitQuestLogo({ size = 80, showText = false }: Props) {
  // SVG viewBox is 1024×1024 — scale everything proportionally
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      <Defs>
        <LinearGradient id="logoBg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#0A0E17" />
          <Stop offset="100%" stopColor="#050810" />
        </LinearGradient>
        <LinearGradient id="logoAccent" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#34D399" />
          <Stop offset="100%" stopColor="#10B981" />
        </LinearGradient>
        <LinearGradient id="logoGlow" x1="0.5" y1="0" x2="0.5" y2="1">
          <Stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
          <Stop offset="100%" stopColor="#10B981" stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {/* Background rounded square */}
      <Rect width="1024" height="1024" rx="220" fill="url(#logoBg)" />

      {/* Subtle glow from top */}
      <Ellipse cx="512" cy="280" rx="400" ry="250" fill="url(#logoGlow)" />

      {/* Shield outline */}
      <Path
        d="M512 160 C620 160, 740 200, 800 260 L800 520 C800 680, 680 800, 512 880 C344 800, 224 680, 224 520 L224 260 C284 200, 404 160, 512 160Z"
        fill="none"
        stroke="url(#logoAccent)"
        strokeWidth="12"
        strokeLinejoin="round"
      />

      {/* Inner shield fill (subtle) */}
      <Path
        d="M512 190 C608 190, 718 226, 772 280 L772 515 C772 660, 662 772, 512 846 C362 772, 252 660, 252 515 L252 280 C306 226, 416 190, 512 190Z"
        fill="#10B981"
        fillOpacity={0.08}
      />

      {/* Running figure — Head */}
      <Circle cx="512" cy="330" r="48" fill="url(#logoAccent)" />
      {/* Body */}
      <Line x1="512" y1="378" x2="512" y2="540" stroke="url(#logoAccent)" strokeWidth="18" strokeLinecap="round" />
      {/* Left arm up */}
      <Line x1="512" y1="420" x2="430" y2="370" stroke="url(#logoAccent)" strokeWidth="16" strokeLinecap="round" />
      {/* Right arm forward */}
      <Line x1="512" y1="420" x2="600" y2="460" stroke="url(#logoAccent)" strokeWidth="16" strokeLinecap="round" />
      {/* Left leg */}
      <Line x1="512" y1="540" x2="430" y2="660" stroke="url(#logoAccent)" strokeWidth="18" strokeLinecap="round" />
      {/* Right leg forward */}
      <Line x1="512" y1="540" x2="600" y2="650" stroke="url(#logoAccent)" strokeWidth="18" strokeLinecap="round" />

      {/* "FQ" text at bottom */}
      {showText && (
        <SvgText
          x="512"
          y="790"
          textAnchor="middle"
          fontFamily="Arial Black, Arial, sans-serif"
          fontWeight="900"
          fontSize="96"
          fill="#F4F5F9"
          letterSpacing={8}
        >
          FQ
        </SvgText>
      )}
    </Svg>
  );
}
