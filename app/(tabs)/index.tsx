import React, { useMemo, useRef, useState, useEffect } from 'react';
import { StyleSheet, View, Text, Alert, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Mapbox from '@rnmapbox/maps';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

Mapbox.setAccessToken(Constants.expoConfig?.extra?.mapboxPublicToken || '');

type SpotFeature = {
  type: 'Feature';
  properties: {
    id: string;
    name: string;
    vibe: string;
    intensity: number;
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
};

export default function MapScreen() {

  const centerOnUser = () => {
    if (userCoords && cameraRef.current) {
      cameraRef.current.flyTo(userCoords, 1000); // 1-second smooth glide
    } else {
      Alert.alert("Location not found", "Still waiting for GPS lock...");
    }
  };

  const NYC_COORDS: [number, number] = [-74.0060, 40.7128];

  const cameraRef = useRef<Mapbox.Camera>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['14%', '40%', '90%'], []);

  const [selectedSpot, setSelectedSpot] = useState<SpotFeature | null>(null);
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentCity, setCurrentCity] = useState<string | null>(null);

  const [alertConfig, setAlertConfig] = useState<{ msg: string; type: 'error' | 'warning' | 'success' | null }>({ msg: '', type: null });
  const slideAnim = useRef(new Animated.Value(-100)).current; // Start off-screen

  const safeHaptic = async (style: Haptics.ImpactFeedbackStyle) => {
    try {
      // Check if the method exists before calling it
      if (Haptics && typeof Haptics.impactAsync === 'function') {
        await Haptics.impactAsync(style);
      }
    } catch (error) {
      // If it fails, the app keeps running and the user just doesn't feel the buzz
      console.log("Haptics unavailable");
    }
  };

  const triggerAlert = (msg: string, type: 'error' | 'warning' | 'success') => {
    setAlertConfig({ msg, type });

    // Slide down
    Animated.spring(slideAnim, {
      toValue: 50, // Final position from top
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();

    // Slide back up after 3 seconds
    setTimeout(() => {
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 500,
        useNativeDriver: true,
      }).start(() => setAlertConfig({ msg: '', type: null }));
    }, 3000);
  };

  const [featureCollection, setFeatureCollection] = useState({
    type: 'FeatureCollection',
    features: [],
  });

  const fetchSpots = async () => {
    try {
      // Replace with your Fedora IP
      const response = await fetch('http://192.168.1.223:8080/api/spots');
      const data = await response.json();

      // Convert Spring Boot Spot objects to GeoJSON Features
      const features = data.map((spot: any) => ({
        type: 'Feature',
        properties: {
          id: spot.id,
          name: spot.name,
          vibe: spot.vibe,
          intensity: spot.intensity,
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
    fetchSpots();
  };

  const buttonBottom = sheetIndex === 0 ? 150 : sheetIndex === 1 ? 300 : -150;

  // 📏 Distance (meters)
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

    if (!selectedSpot) return;

    const spotId = selectedSpot.properties.id;
    const spotCoords = selectedSpot.geometry.coordinates;

    const distance = getDistance(
      userCoords[1], userCoords[0], // User [Lat, Lng]
      spotCoords[1], spotCoords[0]  // Spot [Lat, Lng]
    );

    if (distance > 100) {
      triggerAlert(`You're ${Math.round(distance)}m away. Get closer!`, 'warning');
      safeHaptic(Haptics.ImpactFeedbackStyle.Medium);
      return;
    }

    try {
      const response = await fetch(`http://192.168.1.223:8080/api/checkins/${spotId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        triggerAlert(`You're checked in at ${selectedSpot?.properties.name}!`, 'success')
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

      // --- REVERSE GEOCODING LOGIC ---
      try {
        const reverseCoords = { latitude: coords[1], longitude: coords[0] };
        const address = await Location.reverseGeocodeAsync(reverseCoords);
        if (address.length > 0) {
          // Most addresses return a "city" or "district"
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
        <ActivityIndicator size="large" color="#FB923C" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <Mapbox.MapView
          scaleBarEnabled={false}
          logoEnabled={true}
          logoPosition={{ top: 10, left: 10 }} // Nudge it up so the BottomSheet doesn't hide it
          attributionEnabled={true}
          attributionPosition={{ top: 10, left: 100 }}
          compassEnabled={true}
          compassPosition={{ top: 45, left: 35 }}
          style={styles.map}
          styleURL={Mapbox.StyleURL.Light}
          onPress={() => {
            setSelectedSpot(null);
            bottomSheetRef.current?.snapToIndex(0);
          }}
        >
          <Mapbox.UserLocation visible />

          <Mapbox.ShapeSource
            id="spots"
            shape={featureCollection} // Use the state here
            hitbox={{ width: 44, height: 44 }}
            onPress={async (event) => {
              const feature = event.features?.[0];
              if (!feature) return;

              // selectedSpot now works with the dynamic data
              setSelectedSpot(feature);

              bottomSheetRef.current?.snapToIndex(1);
              cameraRef.current?.flyTo(feature.geometry.coordinates, 800);
            }}
          >

            <Mapbox.CircleLayer
              id="spots-anchor"
              style={{
                circleRadius: 5,
                circleColor: '#FB923C', // Neutral grey
                circleStrokeWidth: 1,
                circleStrokeColor: 'black',
                circleOpacity: 0.8,
              }}
            />

            <Mapbox.CircleLayer
              id="spots-layer"
              existing={false}
              style={{
                circleRadius: 25,
                circleColor: '#FB923C',
                circleOpacity: ['get', 'intensity'],
                circleBlur: 0.8,
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
          pointerEvents={sheetIndex === 2 ? 'none' : 'auto'}
        >
          <MaterialIcons name="my-location" size={24} color="#374151" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.floatingButton,
            {
              // Position it exactly 60px (button height + gap) above the find-me button
              bottom: buttonBottom + 64,
              opacity: sheetIndex === 2 ? 0 : 1,
              backgroundColor: '#FB923C' // Distinct color for refresh
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
              // 💡 LIVE DATA LOOKUP: Find the current version of this spot in your main state
              const liveSpot = featureCollection?.features.find(
                (f) => f.properties.id === selectedSpot.properties.id
              );

              // Fallback to selectedSpot if liveSpot isn't found during a transition
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

                      {/* The Progress Bar */}
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
                    color="#3ca5fb"
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
              alertConfig.type === 'success' ? '#10B981' : // Emerald Green
                alertConfig.type === 'error' ? '#EF4444' :   // Red
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  map: { flex: 1 },
  sheetBackground: { backgroundColor: '#FFFBEB' },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
    alignItems: 'center'
  },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1F2937' },
  subtitle: { fontSize: 16, fontWeight: '500', color: '#6B7280', marginBottom: 15 },
  spotCard: {
    marginTop: 20,
    width: '100%',
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 15
  },
  vibeText: { fontSize: 16, fontWeight: '600' },
  floatingButton: {
    position: 'absolute',
    right: 20,
    backgroundColor: 'white',
    width: 48,           // Fixed width and height ensures 
    height: 48,          // they stay square
    borderRadius: 18,    // Lower value = Square with rounded corners
    elevation: 5,
    shadowColor: '#000',
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
    elevation: 5, // Shadow for Android
    shadowColor: '#000',
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
    color: '#4B5563', // Slate grey
  },
  barTrack: {
    height: 12,
    width: '100%',
    backgroundColor: '#E5E7EB', // Light grey track
    borderRadius: 6,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#FB923C', // A slightly lighter, "glowing" amber
    borderRadius: 5,
    // Add an inner "pulse" look
    borderRightWidth: 3,
    borderRightColor: '#FB923C',
  },
  checkInButton: {
    width: '100%',
    backgroundColor: '#0D9488', // Deep Midnight Slate (Very premium on OLED screens)
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    // Elevation for that Pixel 9 Pro depth
    elevation: 4,
  },
  buttonText: {
    color: 'white',
    fontWeight: '700',
    letterSpacing: 0.5,
    fontSize: 16,
  },
});