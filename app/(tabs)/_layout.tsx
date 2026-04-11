import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#FB923C' }}>
      <Tabs.Screen name="index" options={{ title: 'Map' }} />
    </Tabs>
  );
}