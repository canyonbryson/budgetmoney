import * as React from 'react';
import { View, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';

import { Colors } from '@/constants/Colors';
import { TabBarIcon } from '@/components/navigation/TabBarIcon';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function TabLayout() {
  const activeTabColor = useThemeColor({}, 'tabIconSelected');
  const inactiveTabColor = useThemeColor({}, 'tabIconDefault');

  return (
    <Tabs 
      screenOptions={{ 
        headerShown: false,
        tabBarStyle: {
          height: 66,
          borderRadius: 22,
          borderWidth: 1,
          marginHorizontal: 12,
          marginBottom: 12,
          position: 'absolute',
          backgroundColor: 'transparent',
        },
        tabBarActiveTintColor: activeTabColor,
        tabBarInactiveTintColor: inactiveTabColor,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
        tabBarBackground: () => (
          Platform.OS === 'ios' ? (
            <BlurView
              tint="light"
              intensity={60}
              style={{
                flex: 1,
                borderRadius: 22,
                overflow: 'hidden',
              }}
            />
          ) : (
            <View
              style={{
                flex: 1,
                backgroundColor: Colors.light.background,
                borderRadius: 22,
                overflow: 'hidden',
              }}
            />
          )
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'home' : 'home-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ask-ai"
        options={{
          title: 'Ask AI',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'chatbubble' : 'chatbubble-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="injured"
        options={{
          title: 'Injured',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'medkit' : 'medkit-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="providers"
        options={{
          title: 'Providers',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'people' : 'people-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'settings' : 'settings-outline'} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}




