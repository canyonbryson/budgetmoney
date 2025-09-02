import { Redirect, Tabs } from 'expo-router';
import React from 'react';

import { TabBarIcon } from '@/components/navigation/TabBarIcon';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
// Import the `useAuth` hook from Clerk
import { useAuth } from '@clerk/clerk-expo';
import { useSettings } from '@/contexts/SettingsContext';
import { t } from '@/i18n';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { language } = useSettings();
    // Redirect if the user is not signed in
    const { isSignedIn } = useAuth()
    if(!isSignedIn) {
      return (
        <Redirect href={'/sign-in'} />
      )
    }


  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t(language, 'home'),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'home' : 'home-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ask-ai"
        options={{
          title: t(language, 'askAi'),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'chatbubble' : 'chatbubble-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          // Keep route for backwards compat but hide it
          href: null,
          title: 'Hidden',
          tabBarButton: () => null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t(language, 'settings'),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'cog' : 'cog-outline'} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
