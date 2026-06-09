import { Tabs } from 'expo-router';
import { useTheme, AppTheme } from '../../theme/ThemeContext';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'react-native';
import { useAuth } from '../_layout';

export default function TabLayout() {
  const { theme } = useTheme();
  const { user } = useAuth();

  return (
    <Tabs
      screenOptions={{
        // This fixes the Tab Bar background
        tabBarStyle: {
          backgroundColor: theme.cardLighter,
          borderTopColor: theme.border,
          // 1. Increase height (default is usually ~50-60)
          height: 85,
          // 2. Add padding to keep icons from hitting the bottom edge
          paddingBottom: 12,
          paddingTop: 8,
          // 3. Optional: Remove the shadow/border for a flatter look
          elevation: 0,
          borderTopWidth: 1,
        },
        // This fixes the Header background
        headerStyle: {
          backgroundColor: theme.cardLighter,
        },
        headerTitleStyle: {
          color: theme.text,
        },
        tabBarActiveTintColor: '#FB923C', // Revynd Orange
        tabBarInactiveTintColor: '#94A3B8',
        headerShown: true, // If you want the title at the top
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Map',
          headerTitle: 'REVYND',
          tabBarIcon: ({ color }) => <MaterialIcons name="map" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => <MaterialIcons name="history" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Account',
          ...(user?.profilePicture ? {
            tabBarLabel: () => null,
            tabBarIcon: ({ focused }) => (
              <Image
                source={{ uri: user.profilePicture }}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  borderWidth: focused ? 2 : 1,
                  borderColor: focused ? '#FB923C' : theme.border,
                  marginTop: 6,
                }}
              />
            ),
          } : {
            tabBarIcon: ({ color }) => <MaterialIcons name="person" size={26} color={color} />,
          })
        }}
      />
    </Tabs>
  );
}