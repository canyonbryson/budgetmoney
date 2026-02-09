import { Redirect } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import { Tabs } from 'expo-router';
import React from 'react';

import { TabBarIcon } from '@/components/navigation/TabBarIcon';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useSettings } from '@/contexts/SettingsContext';
import { t } from '@/i18n';

export default function AuthRoutesLayout() {
  const { colors } = useAppTheme();
  const { isSignedIn } = useAuth()
  const { language } = useSettings();

  if (isSignedIn) {
    return <Redirect href={'/'} />
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarStyle: { backgroundColor: colors.backgroundCard },
        headerShown: false
      }}>
      <Tabs.Screen
        name="sign-in"
        options={{
          title: t(language, 'signIn'),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'person' : 'person-outline'} color={color} />
          ),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="sign-up"
        options={{
          title: t(language, 'signUp'),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'person-add' : 'person-add-outline'} color={color} />
          ),
          headerShown: false
        }}
      />
    </Tabs>
  )
}
