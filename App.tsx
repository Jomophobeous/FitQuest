import React from 'react';
import { Slot } from 'expo-router';
import { ThemeProvider } from './src/context/ThemeContext';

// This app is fully serverless - all data stored on-device via SQLite
// The real provider hierarchy lives in app/_layout.tsx
export default function App() {
  return (
    <ThemeProvider>
      <Slot />
    </ThemeProvider>
  );
}
