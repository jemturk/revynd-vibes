import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '../theme/ThemeContext';
import { useEffect, useState, createContext, useContext } from 'react';
import Constants from 'expo-constants';
import Mapbox from '@rnmapbox/maps';
import * as SecureStore from 'expo-secure-store';
import * as Linking from 'expo-linking';

export type UserSession = {
  name: string;
  email: string;
  profilePicture?: string;
} | null;

const AuthContext = createContext<{ 
  user: UserSession; 
  signIn: (userData: UserSession) => Promise<void> | void; 
  signOut: () => Promise<void> | void;
} | null>(null);

export const useAuth = () => useContext(AuthContext)!;


// Fetch the securely compiled token straight out of your app config's extra block
const publicToken = Constants.expoConfig?.extra?.mapboxPublicToken;

if (publicToken) {
  Mapbox.setAccessToken(publicToken);
} else {
  console.warn("Mapbox Token missing from Expo Constants configuration framework.");
}

export default function Layout() {
  const [user, setUser] = useState<UserSession>(null);
  const [isReady, setIsReady] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const handleInitialUrl = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        parseAndSaveReferrer(initialUrl);
      }
    };

    const subscription = Linking.addEventListener('url', (event) => {
      if (event.url) {
        parseAndSaveReferrer(event.url);
      }
    });

    handleInitialUrl();

    return () => {
      subscription.remove();
    };
  }, []);

  const parseAndSaveReferrer = async (urlStr: string) => {
    try {
      const parsed = Linking.parse(urlStr);
      const refId = parsed.queryParams?.referrerId;
      if (refId) {
        console.log('Detected referrerId from deep link:', refId);
        await SecureStore.setItemAsync('invite_referrer_id', refId as string);
      }
    } catch (e) {
      console.error('Failed to parse deep link URL', e);
    }
  };

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const token = await SecureStore.getItemAsync('user_token');
        const sessionStr = await SecureStore.getItemAsync('user_session');

        if (token && sessionStr) {
          const session = JSON.parse(sessionStr);
          const sessionAge = Date.now() - (session.loginTime || 0);
          const MAX_SESSION_AGE = 10 * 24 * 60 * 60 * 1000; // 10 days in ms

          if (sessionAge < MAX_SESSION_AGE) {
            setUser({
              name: session.name,
              email: session.email,
              profilePicture: session.profilePicture,
            });
          } else {
            // Session expired, clean up
            await SecureStore.deleteItemAsync('user_session');
            await SecureStore.deleteItemAsync('user_token');
            await SecureStore.deleteItemAsync('userId');
          }
        }
      } catch (error) {
        console.error('Error restoring session:', error);
      } finally {
        setIsReady(true);
      }
    };

    restoreSession();
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

  const signIn = async (userData: UserSession) => {
    if (userData) {
      try {
        await SecureStore.setItemAsync('user_session', JSON.stringify({
          ...userData,
          loginTime: Date.now()
        }));
      } catch (error) {
        console.error('Error saving user session:', error);
      }
    }
    setUser(userData);
  };

  const signOut = async () => {
    try {
      await SecureStore.deleteItemAsync('user_session');
      await SecureStore.deleteItemAsync('user_token');
      await SecureStore.deleteItemAsync('userId');
    } catch (error) {
      console.error('Error clearing local cache tokens during sign out:', error);
    } finally {
      setUser(null);
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthContext.Provider value={{
          user,
          signIn,
          signOut
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