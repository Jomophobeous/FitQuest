import React from 'react';
import { Tabs } from 'expo-router';
import { ApolloProvider } from '@apollo/client';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { LanguageProvider } from '../src/context/LanguageContext';
import { DatabaseProvider } from '../src/context/DatabaseContext';
import { SubscriptionProvider } from '../src/purchases/SubscriptionContext';
import { mockApolloClient } from '../src/services/mock-apollo-client';
import { apolloClient } from '../src/services/apollo-client';
import { DropdownMenu } from '../src/components/DropdownMenu';

// Toggle mock vs real API via EXPO_PUBLIC_USE_MOCK_API
// Set to 'false' to use local SQLite database (recommended)
const useMockAPI = process.env.EXPO_PUBLIC_USE_MOCK_API === 'true';
const client = useMockAPI ? mockApolloClient : apolloClient;

function ThemedTabs() {
  const { theme } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.surface,
          borderBottomColor: theme.colors.border,
          borderBottomWidth: 1,
        },
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
        },
        headerRight: () => <DropdownMenu />,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          paddingTop: 8,
          height: 60,
        },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 2,
          marginBottom: 4,
        },
      }}
    >
      {/* Dashboard Tab */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="view-dashboard" size={22} color={color} />
          ),
        }}
      />

      {/* FitQuest Tab - AI Workout Generator */}
      <Tabs.Screen
        name="fitquest"
        options={{
          title: 'Train',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="lightning-bolt" size={22} color={color} />
          ),
        }}
      />

      {/* Move Tab - Steps & Jog */}
      <Tabs.Screen
        name="move"
        options={{
          title: 'Move',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="shoe-print" size={22} color={color} />
          ),
        }}
      />

      {/* FitMind Library Tab */}
      <Tabs.Screen
        name="fitmind-library"
        options={{
          title: 'Mind',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="book-open-variant" size={22} color={color} />
          ),
        }}
      />

      {/* Profile Tab */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="account" size={22} color={color} />
          ),
        }}
      />

      {/* Hidden Screens (not in tab bar) */}
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="login"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="register"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="splash"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="onboarding"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="workouts/index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="workouts/[id]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="style-guide"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          href: null,
          title: 'Progress',
        }}
      />
      <Tabs.Screen
        name="create-workout"
        options={{
          href: null,
          title: 'Create Workout',
        }}
      />
      <Tabs.Screen
        name="coach/index"
        options={{
          href: null,
          title: 'AI Coach',
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          href: null,
          title: 'Analytics',
        }}
      />
      <Tabs.Screen
        name="saved-workouts"
        options={{
          href: null,
          title: 'My Workouts',
        }}
      />
      <Tabs.Screen
        name="meal-prep"
        options={{
          href: null,
          title: 'Meal Prep',
        }}
      />
      <Tabs.Screen
        name="craft-my-body"
        options={{
          href: null,
          title: 'Craft My Body',
        }}
      />
      <Tabs.Screen
        name="paywall"
        options={{
          href: null,
          title: 'Premium',
        }}
      />
      <Tabs.Screen
        name="health-dashboard"
        options={{
          href: null,
          title: 'Health',
        }}
      />
      <Tabs.Screen
        name="fitmind-reader"
        options={{
          href: null,
          title: 'Reader',
        }}
      />
      <Tabs.Screen
        name="exercises"
        options={{
          href: null,
          title: 'Exercises',
        }}
      />
    </Tabs>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <DatabaseProvider>
          <SubscriptionProvider>
            <ApolloProvider client={client}>
              <ThemedTabs />
            </ApolloProvider>
          </SubscriptionProvider>
        </DatabaseProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
