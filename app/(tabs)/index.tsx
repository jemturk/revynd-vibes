import React, { useMemo, useRef, useState, useEffect } from 'react';
import { StyleSheet, View, Text, Alert, TouchableOpacity, ActivityIndicator, Animated, Easing, StatusBar } from 'react-native';
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

const API_URL = 'https://revynd-api-939729691035.us-east1.run.app';

Mapbox.setAccessToken(Constants.expoConfig?.extra?.mapboxPublicToken || '');

type SpotFeature = Feature<Point, {
  id: string;
  name: string;
  vibe: string;
  intensity: number;
  isSaved: boolean;
}>;

export default function MapScreen() {
  const { theme, isDark } = useTheme();

  const cameraRef = useRef<Mapbox.Camera>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['14%', '40%', '90%'], []);

  const [selectedSpot, setSelectedSpot] = useState<SpotFeature | null>(null);
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentCity, setCurrentCity] = useState<string | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  const [alertConfig, setAlertConfig] = useState<{ msg: string; type: 'error' | 'warning' | 'success' | null }>({ msg: '', type: null });
  const slideAnim = useRef(new Animated.Value(-100)).current; // Start off-screen
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      cameraRef.current.flyTo(userCoords, 1000); // 1-second smooth glide
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

  const [featureCollection, setFeatureCollection] = useState<FeatureCollection<Point, {
    id: string;
    name: string;
    vibe: string;
    intensity: number;
  }>>({
    type: 'FeatureCollection',
    features: [],
  });

  const fetchSpots = async (coords?: [number, number]) => {
    try {
      const activeCoords = coords || userCoords || NYC_COORDS;
      const response = await fetch(`${API_URL}/api/spots/explore?lat=${activeCoords[1]}&lng=${activeCoords[0]}&categories=bar,coffee_shop_cafe,skate_park,skatepark`, {
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
          intensity: spot.intensity,
          isSaved: spot.saved,
        },
        geometry: {
          type: 'Point',
          coordinates: [spot.location[0], spot.location[1]],
        },
      }));

      setFeatureCollection({
        type: 'FeatureCollection',
        features: features,
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
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchSpots(userCoords || undefined);
  };

  const buttonBottom = sheetIndex === 0 ? 150 : sheetIndex === 1 ? 300 : -150;

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

  const handleCheckIn = async () => {
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

    setIsCheckingIn(true);
    try {
      const response = await fetch(`${API_URL}/api/checkins/checkins`, {
        method: 'POST',
        headers: await buildAuthHeaders('application/json'),
        body: JSON.stringify({
          id: spotId,
          name: selectedSpot.properties.name,
          vibe: selectedSpot.properties.vibe,
          location: [spotCoords[0], spotCoords[1]],
        }),
      });

      if (response.ok) {
        triggerAlert(`You're checked in at ${selectedSpot?.properties.name}!`, 'success');
        safeHaptic(Haptics.ImpactFeedbackStyle.Light);
        handleRefresh();
      } else if (response.status === 429) {
        triggerAlert("Whoa! Only one check-in per hour at one spot.", 'error');
        safeHaptic(Haptics.ImpactFeedbackStyle.Medium);
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
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const location = await Location.getCurrentPositionAsync({});
      const coords: [number, number] = [
        location.coords.longitude,
        location.coords.latitude,
      ];
      setUserCoords(coords);
      fetchSpots(coords);

      try {
        const reverseCoords = { latitude: coords[1], longitude: coords[0] };
        const address = await Location.reverseGeocodeAsync(reverseCoords);
        if (address.length > 0) {
          setCurrentCity(address[0].city || address[0].subregion);
        }
      } catch (e) {
        console.error("Reverse geocoding failed", e);
      }

      cameraRef.current?.setCamera({
        centerCoordinate: coords ? coords : NYC_COORDS,
        zoomLevel: 14,
        animationDuration: 1000,
      });
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
              filter={['>', ['get', 'intensity'], 0]}
              style={{
                circleRadius: pulseRadius,
                circleColor: [
                  'case',
                  ['>=', ['get', 'intensity'], 0.8], '#EC4899',
                  ['>', ['get', 'intensity'], 0.2], '#F97316',
                  '#FB923C'
                ],
                circleOpacity: pulseOpacity,
                circleBlur: 0.4,
                circleOpacityTransition: { duration: 0 },
                circleRadiusTransition: { duration: 0 }
              }}
            />

            {/* LAYER 2: Core Base Glow (Static ambient blur scaled by backend intensity) */}
            <Mapbox.CircleLayer
              id="spots-ambient-glow"
              style={{
                circleRadius: [
                  'case',
                  ['>=', ['get', 'intensity'], 0.8], 52,
                  ['>', ['get', 'intensity'], 0.2], 30,
                  ['==', ['get', 'isSaved'], false], 0, // No ambient glow for unsaved places
                  14
                ],
                circleColor: [
                  'case',
                  ['>=', ['get', 'intensity'], 0.8], '#EC4899',
                  ['>', ['get', 'intensity'], 0.2], '#F97316',
                  '#FB923C'
                ],
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
              style={{
                circleRadius: [
                  'case',
                  ['>=', ['get', 'intensity'], 0.8], 8,
                  ['>', ['get', 'intensity'], 0.2], 6,
                  ['==', ['get', 'isSaved'], false], 3.5, // Smaller dot for unsaved places
                  4.5
                ],
                circleColor: [
                  'case',
                  ['==', ['get', 'isSaved'], false], '#9CA3AF', // Gray center for unsaved
                  theme.card
                ],
                circleStrokeWidth: [
                  'case',
                  ['>=', ['get', 'intensity'], 0.8], 3.5,
                  ['>', ['get', 'intensity'], 0.2], 2.5,
                  ['==', ['get', 'isSaved'], false], 1.5,
                  2.0
                ],
                circleStrokeColor: [
                  'case',
                  ['>=', ['get', 'intensity'], 0.8], '#EC4899',
                  ['>', ['get', 'intensity'], 0.2], '#F97316',
                  ['==', ['get', 'isSaved'], false], '#6B7280', // Gray stroke for unsaved
                  '#FB923C'
                ],
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
            { bottom: buttonBottom, opacity: sheetIndex === 2 ? 0 : 1 }
          ]}
          onPress={centerOnUser}
          activeOpacity={0.7}
          disabled={sheetIndex === 2}
        >
          <MaterialIcons name="my-location" size={24} color={theme.subtext} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.floatingButton,
            {
              bottom: buttonBottom + 64,
              opacity: sheetIndex === 2 ? 0 : 1,
              backgroundColor: theme.primary
            }
          ]}
          onPress={handleRefresh}
          disabled={isRefreshing}
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
              const liveSpot = featureCollection?.features.find(
                (f) => f.properties.id === selectedSpot.properties.id
              );
              const displaySpot = liveSpot || selectedSpot;

              return (
                <>
                  <Text style={styles.title}>
                    {displaySpot.properties.name} 🧭
                  </Text>
                  <Text style={styles.subtitle}>
                    {displaySpot.properties.vibe}
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

                    <TouchableOpacity
                      style={styles.checkInButton}
                      onPress={handleCheckIn}
                    >
                      <Text style={styles.buttonText}>Check In</Text>
                    </TouchableOpacity>
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