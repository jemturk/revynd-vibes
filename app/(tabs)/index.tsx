import React, { useMemo, useRef, useState, useEffect } from 'react';
import { StyleSheet, View, Text, Alert, TouchableOpacity, ActivityIndicator, Animated, Easing, StatusBar, ScrollView, Modal } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Mapbox from '@rnmapbox/maps';
import type { Feature, FeatureCollection, Point } from 'geojson';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme/ThemeContext';
import { useLocalSearchParams, router } from 'expo-router';

const VIBE_TAGS_BY_CATEGORY: Record<string, string[]> = {
  'Cafe': ['Cozy', 'Packed', 'Great for working', 'Loud'],
  'Bar': ['Live Music', 'Chill', 'Rowdy', 'Happy Hour'],
  'Restaurant': ['Date Night', 'Bustling', 'Quick Bite', 'Fancy'],
  'Skate Spot': ['Empty', 'Packed', 'Session going down', 'Chill'],
  'Tennis': ['Courts open', 'Packed', 'Tourney', 'Chill'],
  'default': ['Lit', 'Chill', 'Packed', 'Dead']
};

const ALL_CATEGORIES = Object.keys(VIBE_TAGS_BY_CATEGORY).filter(c => c !== 'default');

const API_URL = 'https://revynd-api-939729691035.us-east1.run.app';

Mapbox.setAccessToken(Constants.expoConfig?.extra?.mapboxPublicToken || '');

type SpotFeature = Feature<Point, {
  id: string;
  name: string;
  vibe: string;
  category: string;
  intensity: number;
  isSaved: boolean;
}>;

const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

export default function MapScreen() {
  const { theme, isDark } = useTheme();
  const params = useLocalSearchParams();

  const cameraRef = useRef<Mapbox.Camera>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['14%', '40%', '60%', '90%'], []);

  const [selectedSpot, setSelectedSpot] = useState<SpotFeature | null>(null);
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentCity, setCurrentCity] = useState<string | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [showVibeSelection, setShowVibeSelection] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);

  const [alertConfig, setAlertConfig] = useState<{ msg: string; type: 'error' | 'warning' | 'success' | null }>({ msg: '', type: null });
  const slideAnim = useRef(new Animated.Value(-100)).current; // Start off-screen
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fetchingSpotIdRef = useRef<string | null>(null);

  const [lastCheckIns, setLastCheckIns] = useState<Record<string, number>>({});
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  // Category Color Palette Mapbox Expression
  const categoryColorMatch = [
    'match',
    ['get', 'category'],
    'Skate Spot', '#EC4899', // Pink
    'Cafe', '#D97706',       // Amber/Brown
    'Bar', '#8B5CF6',        // Purple
    'Restaurant', '#3B82F6', // Blue
    'Tennis', '#22C55E',     // Green
    '#FB923C'                // Default Revynd Orange
  ] as any;

  // Animated value driving the expanding pulse ripple layer
  const pulseAnim = useRef(new Animated.Value(0)).current;

  // Infinite loop configuration for breathing glow pulses
  useEffect(() => {
    const startPulse = () => {
      pulseAnim.setValue(0);
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 2500, // Speed of the ambient pulse wave
        easing: Easing.out(Easing.ease),
        useNativeDriver: false, // Mapbox layout evaluations require standard JS interpolation bridges
      }).start(() => startPulse());
    };

    startPulse();
  }, [pulseAnim]);

  // Interpolated streams bridging React Native values straight into Mapbox styles
  const pulseRadius = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 55],
  });

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0.6, 0.4, 0],
  });

  const centerOnUser = () => {
    if (userCoords && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: userCoords,
        zoomLevel: 14,
        animationDuration: 1000,
      });
    } else {
      Alert.alert("Location not found", "Still waiting for GPS lock...");
    }
  };

  const NYC_COORDS: [number, number] = [-74.0060, 40.7128];

  const buildAuthHeaders = async (contentType?: string) => {
    const token = await SecureStore.getItemAsync('user_token');
    return {
      Accept: 'application/json',
      ...(contentType ? { 'Content-Type': contentType } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    map: { flex: 1 },
    sheetBackground: { backgroundColor: theme.card },
    contentContainer: {
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 40,
      alignItems: 'center'
    },
    title: { fontSize: 22, fontWeight: 'bold', color: theme.text },
    subtitle: { fontSize: 16, fontWeight: '500', color: theme.subtext, marginBottom: 15 },
    spotCard: {
      marginTop: 20,
      width: '100%',
      padding: 20,
      backgroundColor: theme.card,
      borderRadius: 15
    },
    floatingButton: {
      position: 'absolute',
      right: 20,
      backgroundColor: theme.card,
      width: 48,
      height: 48,
      borderRadius: 18,
      elevation: 5,
      shadowColor: theme.text,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
    },
    customAlert: {
      position: 'absolute',
      left: 20,
      right: 20,
      padding: 16,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      elevation: 5,
      shadowColor: theme.text,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      zIndex: 1000,
    },
    alertText: {
      color: 'white',
      fontWeight: '600',
      marginLeft: 10,
      fontSize: 14,
    },
    densityContainer: {
      width: '100%',
      marginBottom: 20,
    },
    densityHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 8,
    },
    densityLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.subtext,
    },
    barTrack: {
      height: 12,
      width: '100%',
      backgroundColor: theme.border,
      borderRadius: 6,
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      backgroundColor: '#FB923C',
      borderRadius: 5,
      borderRightWidth: 3,
      borderRightColor: '#FB923C',
    },
    checkInButton: {
      width: '100%',
      backgroundColor: '#0D9488',
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 10,
      elevation: 4,
    },
    buttonText: {
      color: 'white',
      fontWeight: '700',
      letterSpacing: 0.5,
      fontSize: 16,
    },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  }), [theme]);

  const safeHaptic = async (style: Haptics.ImpactFeedbackStyle) => {
    try {
      if (Haptics && typeof Haptics.impactAsync === 'function') {
        await Haptics.impactAsync(style);
      }
    } catch (error) {
      console.log("Haptics unavailable");
    }
  };

  const triggerAlert = (msg: string, type: 'error' | 'warning' | 'success') => {
    setAlertConfig({ msg, type });

    Animated.spring(slideAnim, {
      toValue: 50,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();

    setTimeout(() => {
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 500,
        useNativeDriver: true,
      }).start(() => setAlertConfig({ msg: '', type: null }));
    }, 3000);
  };

  const [featureCollection, setFeatureCollection] = useState<FeatureCollection<Point, SpotFeature['properties']>>({
    type: 'FeatureCollection',
    features: [],
  });

  const fetchSpots = async (coords?: [number, number]) => {
    try {
      const activeCoords = coords || userCoords || NYC_COORDS;
      const response = await fetch(`${API_URL}/api/spots/explore?lat=${activeCoords[1]}&lng=${activeCoords[0]}&categories=bar,cafe,coffee,restaurant,tennis_courts,skatepark`, {
        headers: await buildAuthHeaders(),
      });

      const text = await response.text();
      const data = text ? JSON.parse(text) : [];

      if (!response.ok) {
        throw new Error(data?.message || `Failed to load spots (${response.status}).`);
      }

      if (!Array.isArray(data)) {
        throw new Error('Unexpected spot payload format from backend.');
      }

      const features: SpotFeature[] = data.map((spot: any) => ({
        type: 'Feature',
        properties: {
          id: spot.id,
          name: spot.name,
          vibe: spot.vibe,
          category: spot.category,
          intensity: spot.intensity,
          isSaved: spot.saved,
        },
        geometry: {
          type: 'Point',
          coordinates: [spot.location[0], spot.location[1]],
        },
      }));

      setFeatureCollection(prev => {
        const keepSelected = selectedSpot && !features.some(f => String(f.properties.id) === String(selectedSpot.properties.id))
          ? [selectedSpot]
          : [];
        return {
          type: 'FeatureCollection',
          features: [...features, ...keepSelected],
        };
      });
    } catch (error) {
      console.error("Backend fetch failed:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    AsyncStorage.setItem('last_viewed_spot', '');
    fetchSpots();

    const loadCheckIns = async () => {
      try {
        const stored = await AsyncStorage.getItem('last_checkins_by_spot');
        if (stored) {
          setLastCheckIns(JSON.parse(stored));
        }
      } catch (error) {
        console.error('Failed to load check-ins history:', error);
      }
    };
    loadCheckIns();
  }, []);

  useEffect(() => {
    if (params.selectedSpotId) {
      const existingSpot = featureCollection.features.find(
        f => String(f.properties.id) === String(params.selectedSpotId)
      );
      if (existingSpot) {
        setSelectedSpot(existingSpot);
        bottomSheetRef.current?.snapToIndex(1);
        cameraRef.current?.flyTo(existingSpot.geometry.coordinates, 800);
        router.replace('/(tabs)/');
      } else {
        if (fetchingSpotIdRef.current === String(params.selectedSpotId)) return;
        fetchingSpotIdRef.current = String(params.selectedSpotId);

        const fetchSpotAndFocus = async () => {
          try {
            const headers = await buildAuthHeaders();
            const res = await fetch(`${API_URL}/api/spots/${params.selectedSpotId}`, { headers });
            if (res.ok) {
              const spot = await res.json();
              const feature: SpotFeature = {
                type: 'Feature',
                properties: {
                  id: spot.id,
                  name: spot.name,
                  vibe: spot.vibe,
                  category: spot.category,
                  intensity: spot.intensity,
                  isSaved: spot.saved,
                },
                geometry: {
                  type: 'Point',
                  coordinates: [spot.location[0], spot.location[1]],
                },
              };
              setFeatureCollection(prev => ({
                ...prev,
                features: prev.features.some(f => String(f.properties.id) === String(feature.properties.id))
                  ? prev.features
                  : [...prev.features, feature]
              }));
              setSelectedSpot(feature);
              bottomSheetRef.current?.snapToIndex(1);
              cameraRef.current?.flyTo(feature.geometry.coordinates, 800);
              router.replace('/(tabs)/');
            }
          } catch (err) {
            console.error('Failed to fetch and select spot:', err);
          } finally {
            fetchingSpotIdRef.current = null;
          }
        };
        fetchSpotAndFocus();
      }
    }
  }, [params.selectedSpotId, featureCollection]);

  useEffect(() => {
    if (!selectedSpot) {
      setCooldownRemaining(0);
      return;
    }

    const spotId = selectedSpot.properties.id;
    const lastCheckInTime = lastCheckIns[spotId];

    if (!lastCheckInTime) {
      setCooldownRemaining(0);
      return;
    }

    const updateCooldown = () => {
      const elapsed = Date.now() - lastCheckInTime;
      // const remaining = Math.max(0, Math.ceil((60000 - elapsed) / 1000));
      const remaining = Math.max(0, Math.ceil((3000 - elapsed) / 1000));
      setCooldownRemaining(remaining);
      return remaining;
    };

    const remaining = updateCooldown();
    if (remaining <= 0) return;

    const interval = setInterval(() => {
      const rem = updateCooldown();
      if (rem <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [selectedSpot, lastCheckIns]);

  useEffect(() => {
    setShowVibeSelection(false);
  }, [selectedSpot]);

  useEffect(() => {
    if (sheetIndex < 2) {
      setShowVibeSelection(false);
    }
  }, [sheetIndex]);

  useEffect(() => {
    if (!selectedSpot) return;

    const updatedSpot = featureCollection?.features.find((f) => {
      if (f.properties.id === selectedSpot.properties.id) return true;
      const dist = getDistance(
        f.geometry.coordinates[1], f.geometry.coordinates[0],
        selectedSpot.geometry.coordinates[1], selectedSpot.geometry.coordinates[0]
      );
      return dist < 10;
    }) as SpotFeature | undefined;

    if (updatedSpot) {
      if (
        updatedSpot.properties.id !== selectedSpot.properties.id ||
        updatedSpot.properties.intensity !== selectedSpot.properties.intensity ||
        updatedSpot.properties.vibe !== selectedSpot.properties.vibe ||
        updatedSpot.properties.isSaved !== selectedSpot.properties.isSaved
      ) {
        setSelectedSpot(updatedSpot);
      }
    }
  }, [featureCollection, selectedSpot]);

  const handleRefresh = (coords?: any) => {
    setIsRefreshing(true);
    const targetCoords = (coords && Array.isArray(coords)) ? coords : (userCoords || undefined);
    fetchSpots(targetCoords as [number, number] | undefined);
  };

  const buttonBottom = sheetIndex === 0 ? 150 : sheetIndex === 1 ? 300 : -150;

  const handleCheckIn = async (selectedTag: string) => {
    if (!userCoords || !selectedSpot) {
      Alert.alert("GPS Loading", "Wait a second for your location to lock in.");
      return;
    }
    if (isCheckingIn) return;

    const spotId = selectedSpot.properties.id;
    const spotCoords = selectedSpot.geometry.coordinates;

    const distance = getDistance(
      userCoords[1], userCoords[0],
      spotCoords[1], spotCoords[0]
    );

    if (distance > 110000) {
      triggerAlert(`You're ${Math.round(distance)}m away. Get closer to check in!`, 'warning');
      safeHaptic(Haptics.ImpactFeedbackStyle.Medium);
      return;
    }

    setShowVibeSelection(false);
    setIsCheckingIn(true);
    try {
      const response = await fetch(`${API_URL}/api/checkins/checkins`, {
        method: 'POST',
        headers: await buildAuthHeaders('application/json'),
        body: JSON.stringify({
          id: spotId,
          name: selectedSpot.properties.name,
          vibeTag: selectedTag,
          category: selectedSpot.properties.category,
          location: [spotCoords[0], spotCoords[1]],
        }),
      });

      if (response.ok) {
        triggerAlert(`You're checked in at ${selectedSpot?.properties.name}!`, 'success');
        safeHaptic(Haptics.ImpactFeedbackStyle.Light);

        const newCheckIns = {
          ...lastCheckIns,
          [spotId]: Date.now()
        };
        setLastCheckIns(newCheckIns);
        try {
          await AsyncStorage.setItem('last_checkins_by_spot', JSON.stringify(newCheckIns));
        } catch (error) {
          console.error('Failed to save check-in timestamp:', error);
        }

        handleRefresh(spotCoords);
      } else if (response.status === 429) {
        triggerAlert("Whoa! Only one check-in per hour at one spot.", 'error');
        safeHaptic(Haptics.ImpactFeedbackStyle.Medium);

        const newCheckIns = {
          ...lastCheckIns,
          [spotId]: Date.now()
        };
        setLastCheckIns(newCheckIns);
        try {
          await AsyncStorage.setItem('last_checkins_by_spot', JSON.stringify(newCheckIns));
        } catch (error) {
          console.error('Failed to save check-in timestamp:', error);
        }
      } else {
        Alert.alert("Error", "Something went wrong on the server.");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsCheckingIn(false);
    }
  };

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      try {
        const location = await Location.getCurrentPositionAsync({});
        const coords: [number, number] = [
          location.coords.longitude,
          location.coords.latitude,
        ];
        setUserCoords(coords);
        fetchSpots(coords);

        const reverseCoords = { latitude: coords[1], longitude: coords[0] };
        const address = await Location.reverseGeocodeAsync(reverseCoords);
        if (address.length > 0) {
          setCurrentCity(address[0].city || address[0].subregion);
        }

        cameraRef.current?.setCamera({
          centerCoordinate: coords,
          zoomLevel: 14,
          animationDuration: 1000,
        });
      } catch (e) {
        console.error("Initial position retrieval failed", e);
      }

      try {
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 10000, // Update every 10 seconds
            distanceInterval: 10, // Update every 10 meters
          },
          (location) => {
            const coords: [number, number] = [
              location.coords.longitude,
              location.coords.latitude,
            ];
            setUserCoords(coords);
          }
        );
      } catch (e) {
        console.error("Failed to start location watching", e);
      }
    })();

    const loadLastSpot = async () => {
      const saved = await AsyncStorage.getItem('last_viewed_spot');
      if (!saved) return;

      const spot: SpotFeature = JSON.parse(saved);
      setSelectedSpot(spot);

      cameraRef.current?.setCamera({
        centerCoordinate: spot.geometry.coordinates,
        zoomLevel: 14,
        animationDuration: 0,
      });
    };

    loadLastSpot();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent={true}
      />
      <View style={styles.container}>
        <Mapbox.MapView
          scaleBarEnabled={false}
          logoEnabled={true}
          logoPosition={{ top: 10, left: 10 }}
          attributionEnabled={true}
          attributionPosition={{ top: 10, left: 100 }}
          compassEnabled={true}
          compassPosition={{ top: 45, left: 35 }}
          style={styles.map}
          styleURL={isDark ? Mapbox.StyleURL.Dark : Mapbox.StyleURL.Light}
          onPress={() => {
            setSelectedSpot(null);
            bottomSheetRef.current?.snapToIndex(0);
          }}
          onCameraChanged={(e: any) => {
            if (e?.properties?.center) {
              const center = e.properties.center as [number, number];

              // Clear any existing timeout
              if (fetchTimeoutRef.current) {
                clearTimeout(fetchTimeoutRef.current);
              }

              // Set a new timeout to debounce the fetch
              fetchTimeoutRef.current = setTimeout(() => {
                fetchSpots(center);
              }, 500);
            }
          }}
        >
          <Mapbox.UserLocation visible />

          <Mapbox.ShapeSource
            id="spots"
            shape={featureCollection}
            hitbox={{ width: 44, height: 44 }}
            onPress={async (event) => {
              const feature = event.features?.[0] as SpotFeature | undefined;
              if (!feature) return;

              setSelectedSpot(feature);
              bottomSheetRef.current?.snapToIndex(1);
              cameraRef.current?.flyTo(feature.geometry.coordinates, 800);
            }}
          >
            {/* LAYER 1: Dynamic Pulsing Wave (The Background Ripple) */}
            <Mapbox.Animated.CircleLayer
              id="spots-pulse-wave"
              filter={
                selectedCategoryFilter
                  ? ['all', ['>', ['get', 'intensity'], 0], ['==', ['get', 'category'], selectedCategoryFilter]]
                  : ['>', ['get', 'intensity'], 0]
              }
              style={{
                circleRadius: pulseRadius,
                circleColor: categoryColorMatch,
                circleOpacity: pulseOpacity,
                circleBlur: 0.4,
                circleOpacityTransition: { duration: 0 },
                circleRadiusTransition: { duration: 0 }
              }}
            />

            {/* LAYER 2: Core Base Glow (Static ambient blur scaled by backend intensity) */}
            <Mapbox.CircleLayer
              id="spots-ambient-glow"
              filter={selectedCategoryFilter ? ['==', ['get', 'category'], selectedCategoryFilter] : undefined}
              style={{
                circleRadius: [
                  'case',
                  ['>=', ['get', 'intensity'], 0.8], 52,
                  ['>', ['get', 'intensity'], 0.2], 30,
                  ['==', ['get', 'isSaved'], false], 0, // No ambient glow for unsaved places
                  14
                ],
                circleColor: categoryColorMatch,
                circleOpacity: [
                  'case',
                  ['>=', ['get', 'intensity'], 0.8], 0.85,
                  ['>', ['get', 'intensity'], 0.2], 0.5,
                  0.15
                ],
                circleBlur: 0.8,
              }}
            />

            {/* LAYER 3: The Crisp Anchor Pin (Central structural target dot) */}
            <Mapbox.CircleLayer
              id="spots-anchor"
              filter={selectedCategoryFilter ? ['==', ['get', 'category'], selectedCategoryFilter] : undefined}
              style={{
                circleRadius: [
                  'case',
                  ['>=', ['get', 'intensity'], 0.8], 8,
                  ['>', ['get', 'intensity'], 0.2], 6,
                  ['==', ['get', 'isSaved'], false], 3.5, // Smaller dot for unsaved places
                  4.5
                ],
                circleColor: categoryColorMatch,
                circleStrokeWidth: [
                  'case',
                  ['>=', ['get', 'intensity'], 0.8], 3.5,
                  ['>', ['get', 'intensity'], 0.2], 2.5,
                  ['==', ['get', 'isSaved'], false], 0, // No stroke for unsaved to differentiate them
                  2.0
                ],
                circleStrokeColor: isDark ? '#171717' : '#FFFFFF',
                circleOpacity: 1,
              }}
            />
          </Mapbox.ShapeSource>

          <Mapbox.Camera
            ref={cameraRef}
            defaultSettings={{
              centerCoordinate: NYC_COORDS,
              zoomLevel: 16,
            }}
          />
        </Mapbox.MapView>

        <TouchableOpacity
          style={[
            styles.floatingButton,
            {
              bottom: buttonBottom + 128,
              opacity: sheetIndex >= 2 ? 0 : 1,
              backgroundColor: selectedCategoryFilter ? theme.primary : theme.card
            }
          ]}
          onPress={() => setShowFilterModal(true)}
          activeOpacity={0.7}
          disabled={sheetIndex >= 2}
        >
          <MaterialIcons name="filter-list" size={24} color={selectedCategoryFilter ? '#fff' : theme.subtext} />
        </TouchableOpacity>

        {/* Filter Modal */}
        <Modal
          visible={showFilterModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowFilterModal(false)}
        >
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
            activeOpacity={1}
            onPress={() => setShowFilterModal(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={{ width: '100%', maxWidth: 420, backgroundColor: theme.card, borderRadius: 22, padding: 24, alignItems: 'center', elevation: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20 }}
            >
              <Text style={{ fontSize: 20, fontWeight: '700', color: theme.text, marginBottom: 20 }}>Filter by Category</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
                <TouchableOpacity
                  style={{ backgroundColor: selectedCategoryFilter === null ? theme.primary : theme.background, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, borderWidth: 1, borderColor: selectedCategoryFilter === null ? theme.primary : theme.border }}
                  onPress={() => { setSelectedCategoryFilter(null); setShowFilterModal(false); }}
                >
                  <Text style={{ color: selectedCategoryFilter === null ? '#fff' : theme.text, fontWeight: '600', fontSize: 15 }}>All</Text>
                </TouchableOpacity>
                {ALL_CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={{ backgroundColor: selectedCategoryFilter === cat ? theme.primary : theme.background, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, borderWidth: 1, borderColor: selectedCategoryFilter === cat ? theme.primary : theme.border }}
                    onPress={() => { setSelectedCategoryFilter(cat); setShowFilterModal(false); }}
                  >
                    <Text style={{ color: selectedCategoryFilter === cat ? '#fff' : theme.text, fontWeight: '600', fontSize: 15 }}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={{ marginTop: 25, paddingVertical: 12, paddingHorizontal: 30, backgroundColor: theme.background, borderRadius: 14, borderWidth: 1, borderColor: theme.border }}
                onPress={() => setShowFilterModal(false)}
              >
                <Text style={{ color: theme.text, fontWeight: '600', fontSize: 15 }}>Close</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        <TouchableOpacity
          style={[
            styles.floatingButton,
            { bottom: buttonBottom, opacity: sheetIndex >= 2 ? 0 : 1 }
          ]}
          onPress={centerOnUser}
          activeOpacity={0.7}
          disabled={sheetIndex >= 2}
        >
          <MaterialIcons name="my-location" size={24} color={theme.subtext} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.floatingButton,
            {
              bottom: buttonBottom + 64,
              opacity: sheetIndex >= 2 ? 0 : 1,
              backgroundColor: theme.primary
            }
          ]}
          onPress={handleRefresh}
          disabled={isRefreshing || sheetIndex >= 2}
          activeOpacity={0.7}
        >
          {isRefreshing ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <MaterialIcons name="refresh" size={24} color="white" />
          )}
        </TouchableOpacity>

        <BottomSheet
          ref={bottomSheetRef}
          index={0}
          snapPoints={snapPoints}
          backgroundStyle={styles.sheetBackground}
          onChange={(index) => setSheetIndex(index)}
          onAnimate={(fromIndex, toIndex) => setSheetIndex(toIndex)}
        >
          <BottomSheetView style={styles.contentContainer}>
            {selectedSpot ? (() => {
              const liveSpot = featureCollection?.features.find((f) => {
                if (f.properties.id === selectedSpot.properties.id) return true;
                const dist = getDistance(
                  f.geometry.coordinates[1], f.geometry.coordinates[0],
                  selectedSpot.geometry.coordinates[1], selectedSpot.geometry.coordinates[0]
                );
                return dist < 10;
              });
              const displaySpot = liveSpot || selectedSpot;

              return (
                <>
                  <Text style={styles.title}>
                    {displaySpot.properties.name} 🧭
                  </Text>
                  <Text style={styles.subtitle}>
                    {displaySpot.properties.category} {displaySpot.properties.vibe ? `• ${displaySpot.properties.vibe}` : ''}
                  </Text>

                  <View style={styles.spotCard}>
                    <View style={styles.densityContainer}>
                      <View style={styles.densityHeader}>
                        <Text style={styles.densityLabel}>Vibe Crowd</Text>
                      </View>

                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            { width: `${displaySpot.properties.intensity * 100}%` }
                          ]}
                        />
                      </View>
                    </View>

                    {showVibeSelection ? (
                      <View style={{ width: '100%', marginTop: 10 }}>
                        <Text style={[styles.densityLabel, { marginBottom: 10, textAlign: 'center' }]}>What's the vibe right now?</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
                          {(VIBE_TAGS_BY_CATEGORY[displaySpot.properties.category] || VIBE_TAGS_BY_CATEGORY['default']).map((tag) => (
                            <TouchableOpacity
                              key={tag}
                              style={{ backgroundColor: theme.primary + '20', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: theme.primary }}
                              onPress={() => handleCheckIn(tag)}
                            >
                              <Text style={{ color: theme.primary, fontWeight: '600' }}>{tag}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        <TouchableOpacity
                          style={{ marginTop: 15, padding: 10 }}
                          onPress={() => {
                            setShowVibeSelection(false);
                            bottomSheetRef.current?.snapToIndex(1);
                          }}
                        >
                          <Text style={{ color: theme.subtext, textAlign: 'center', fontWeight: '500' }}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[
                          styles.checkInButton,
                          cooldownRemaining > 0 && {
                            backgroundColor: isDark ? 'rgba(13, 148, 136, 0.15)' : 'rgba(13, 148, 136, 0.12)',
                            elevation: 0,
                            shadowOpacity: 0
                          }
                        ]}
                        disabled={cooldownRemaining > 0}
                        onPress={() => {
                          setShowVibeSelection(true);
                          bottomSheetRef.current?.snapToIndex(2);
                        }}
                      >
                        <Text style={[
                          styles.buttonText,
                          cooldownRemaining > 0 && { color: isDark ? 'rgba(45, 212, 191, 0.6)' : 'rgba(13, 148, 136, 0.6)' }
                        ]}>
                          {cooldownRemaining > 0 ? `Vibe Boosted (${cooldownRemaining}s)` : 'Check In'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              );
            })() : (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                  <Text style={styles.title}>
                    Explore {currentCity || "the Area"}
                  </Text>
                  <MaterialIcons
                    name="map"
                    size={24}
                    color={theme.primary}
                    style={{ marginLeft: 8 }}
                  />
                </View>
                <Text style={styles.subtitle}>
                  Tap a glow to reveal the vibe
                </Text>
              </>
            )}
          </BottomSheetView>
        </BottomSheet>

        <Animated.View style={[
          styles.customAlert,
          {
            transform: [{ translateY: slideAnim }],
            backgroundColor:
              alertConfig.type === 'success' ? '#10B981' :
                alertConfig.type === 'error' ? '#EF4444' :
                  '#F59E0B'
          }
        ]}>
          <MaterialIcons
            name={alertConfig.type === 'success' ? "check-circle" :
              alertConfig.type === 'error' ? "block" :
                "location-off"}
            size={20}
            color="white"
          />
          <Text style={styles.alertText}>{alertConfig.msg}</Text>
        </Animated.View>
      </View>
    </GestureHandlerRootView>
  );
}