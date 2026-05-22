import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '../theme/ThemeContext';
import { useEffect, useState, createContext, useContext } from 'react';

// Define a structured User type
export type UserSession = {
  name: string;
  email: string;
} | null;

const AuthContext = createContext<{ 
  user: UserSession; 
  signIn: (userData: UserSession) => void; 
  signOut: () => void 
} | null>(null);

export const useAuth = () => useContext(AuthContext)!;

export default function Layout() {
  const [user, setUser] = useState<UserSession>(null);
  const [isReady, setIsReady] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, segments, isReady]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthContext.Provider value={{
          user,
          signIn: (userData) => setUser(userData), // Now accepts and sets real user profile metrics
          signOut: () => setUser(null)
        }}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)/login" options={{ animation: 'fade' }} />
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          </Stack>
          <StatusBar style="auto" />
        </AuthContext.Provider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}