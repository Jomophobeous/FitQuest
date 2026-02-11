import React from 'react';
import { ApolloProvider } from '@apollo/client';
import { mockApolloClient } from './src/services/mock-apollo-client';
import { Slot } from 'expo-router';
import { ThemeProvider } from './src/context/ThemeContext';

// This app is now fully serverless - using local mock data only
// All data is stored on the device using AsyncStorage
export default function App() {
  return (
    <ThemeProvider>
      <ApolloProvider client={mockApolloClient}>
        <Slot />
      </ApolloProvider>
    </ThemeProvider>
  );
}
