import React from 'react';
import { Redirect } from 'expo-router';

export default function Index() {
  // Always start with the splash screen (handles auth / onboarding routing)
  return <Redirect href="/splash" />;
}
