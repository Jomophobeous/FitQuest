/**
 * FitQuest Splash Screen — Thin route entry point.
 * All rendering delegates to src/features/splash/SplashScreen (Skia GPU-driven).
 */
import React from 'react';
import { SplashScreen } from '../src/features/splash';

export default function Splash() {
  return <SplashScreen />;
}

