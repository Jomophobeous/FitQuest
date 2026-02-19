import React from 'react';
import { Redirect } from 'expo-router';
import { useDatabase } from '../src/context/DatabaseContext';

export default function Index() {
  const { isReady, userProfile } = useDatabase();

  // Wait for database to initialize
  if (!isReady) return null;

  // If no profile exists, send to onboarding
  if (!userProfile) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/dashboard" />;
}
