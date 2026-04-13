import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Platform } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#FB923C', // Revynd Orange
        tabBarInactiveTintColor: '#9CA3AF', // Gray 400
        headerShown: true,
        headerStyle: {
          backgroundColor: '#FFFBEB', // Revynd Cream
          elevation: 0, // Remove Android shadow for a flat look
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          fontWeight: '800',
          fontSize: 20,
          color: '#1F2937',
          letterSpacing: 1.2,
        },
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F3F4F6', // Subtle separator

          // INCREASED DIMENSIONS
          height: Platform.OS === 'android' ? 85 : 95, // Tall enough to feel substantial
          paddingBottom: Platform.OS === 'android' ? 25 : 35, // This is what "lifts" the icons up
          paddingTop: 10,

          // Optional: keep a little shadow/elevation
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 2, // Fine-tune the gap between icon and text
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'REVYND',
          tabBarLabel: 'Explore',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="explore" size={size + 4} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'ACTIVITY',
          tabBarLabel: 'History',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="history" size={size + 4} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'ACCOUNT',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="person-outline" size={size + 4} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}