import { Tabs } from 'expo-router';
import { useTheme } from '../../theme/ThemeContext';
import { MaterialIcons } from '@expo/vector-icons';
import { Image, Platform } from 'react-native';
import { useAuth } from '../_layout';
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const API_URL = 'https://revynd-api-939729691035.us-east1.run.app';

async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF923C',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.log('Failed to get push token: permission not granted');
    return null;
  }

  const projectId = Constants?.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.log('EAS Project ID not found in expoConfig');
    return null;
  }

  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    console.log('Expo Push Token retrieved:', token);
    return token;
  } catch (error) {
    console.error('Error getting Expo Push Token:', error);
    return null;
  }
}

export default function TabLayout() {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const lastNotifiedSpotId = useRef<number | null>(null);
  const lastNotificationTime = useRef<number>(0);

  // Helper method for Haversine distance in meters
  const calculateDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000; // meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const registerDeviceOnBackend = async (pushToken: string | null, lat: number | null, lng: number | null) => {
    try {
      const token = await SecureStore.getItemAsync('user_token');
      if (!token) return;

      await fetch(`${API_URL}/api/auth/register-device`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          pushToken,
          latitude: lat,
          longitude: lng
        })
      });
    } catch (e) {
      console.error('Failed to register device on backend', e);
    }
  };

  const checkProximityToSpots = async (lat: number, lng: number) => {
    try {
      const token = await SecureStore.getItemAsync('user_token');
      if (!token) return;

      const response = await fetch(`${API_URL}/api/spots/nearby?lat=${lat}&lng=${lng}&radius=500`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) return;
      const spots = await response.json();
      
      // Find the closest spot within 50 meters
      for (const spot of spots) {
        const spotCoords = spot.location; // [Lat, Lng]
        if (!spotCoords || spotCoords.length < 2) continue;
        
        const dist = calculateDistanceInMeters(lat, lng, spotCoords[0], spotCoords[1]);
        if (dist <= 50) {
          const now = Date.now();
          // Avoid spamming notifications for the same spot within 30 minutes (1800000 ms)
          if (lastNotifiedSpotId.current === spot.id && (now - lastNotificationTime.current) < 1800000) {
            break; 
          }
          
          lastNotifiedSpotId.current = spot.id;
          lastNotificationTime.current = now;
          
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "Vibe Check-In! 📍",
              body: `Looks like you are near ${spot.name}. Tap to boost and log the vibe!`,
              data: { spotId: String(spot.id) },
            },
            trigger: null, // immediate
          });
          break;
        }
      }
    } catch (e) {
      console.error('Proximity spot check failed', e);
    }
  };

  useEffect(() => {
    if (!user) return;

    let active = true;

    const setupNotificationsAndLocation = async () => {
      // 1. Get Push Token
      const token = await registerForPushNotificationsAsync();
      
      // 2. Request Location Permissions
      const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
      if (locStatus !== 'granted') {
        console.log('Location permission not granted');
        if (active && token) {
          await registerDeviceOnBackend(token, null, null);
        }
        return;
      }

      // Get initial position and send to backend
      try {
        const initialLoc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced
        });
        
        if (active) {
          await registerDeviceOnBackend(token, initialLoc.coords.latitude, initialLoc.coords.longitude);
          const proximityEnabled = await SecureStore.getItemAsync('notif_proximity').then(val => val !== 'false');
          if (proximityEnabled) {
            await checkProximityToSpots(initialLoc.coords.latitude, initialLoc.coords.longitude);
          }
        }
      } catch (e) {
        console.error('Failed to get initial location', e);
        if (active && token) {
          await registerDeviceOnBackend(token, null, null);
        }
      }

      // 3. Monitor Location for proximity & updates
      try {
        locationSubscription.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 30, // 30 meters
            timeInterval: 30000, // 30 seconds
          },
          async (loc) => {
            if (!active) return;
            const { latitude, longitude } = loc.coords;
            
            // Send coordinates to backend to keep lastLocation accurate for Peak Alerts
            await registerDeviceOnBackend(token, latitude, longitude);

            // Proximity check for nearby spots (within 50 meters) if enabled
            const proximityEnabled = await SecureStore.getItemAsync('notif_proximity').then(val => val !== 'false');
            if (proximityEnabled) {
              await checkProximityToSpots(latitude, longitude);
            }
          }
        );
      } catch (err) {
        console.error('Failed to start watching location', err);
      }
    };

    setupNotificationsAndLocation();

    return () => {
      active = false;
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
    };
  }, [user]);

  useEffect(() => {
    // Listen for notification responses (clicks)
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      const spotId = data?.spotId;
      if (spotId) {
        console.log('User clicked notification for spot ID:', spotId);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: theme.cardLighter,
          borderTopColor: theme.border,
          height: 85,
          paddingBottom: 12,
          paddingTop: 8,
          elevation: 0,
          borderTopWidth: 1,
        },
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