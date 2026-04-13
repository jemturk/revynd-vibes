import React, { useMemo, useRef, useState, useEffect } from 'react';
import { StyleSheet, View, Text, Alert, TouchableOpacity } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Mapbox from '@rnmapbox/maps';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';

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

const EXPLORER_SPOTS = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { id: '1', name: 'Jem Castle', vibe: 'Epic Views', intensity: 0.9 },
      geometry: { type: 'Point', coordinates: [-78.866910, 35.711561] },
    },
    {
      type: 'Feature',
      properties: { id: '1', name: 'DUMBO Rooftop', vibe: 'Epic Views', intensity: 0.9 },
      geometry: { type: 'Point', coordinates: [-73.9910, 40.7033] },
    },
    {
      type: 'Feature',
      properties: { id: '2', name: 'LES Skatepark', vibe: 'High Energy', intensity: 0.7 },
      geometry: { type: 'Point', coordinates: [-73.9951, 40.7102] },
    },
    {
      type: 'Feature',
      properties: { id: '3', name: 'High Line Hidden Garden', vibe: 'Chill', intensity: 0.4 },
      geometry: { type: 'Point', coordinates: [-74.0048, 40.7480] },
    },
  ] as SpotFeature[],
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

  const handleCheckIn = () => {
    if (!userCoords || !selectedSpot) return;

    const [spotLng, spotLat] = selectedSpot.geometry.coordinates;

    const distance = getDistance(
      userCoords[1],
      userCoords[0],
      spotLat,
      spotLng
    );

    if (distance < 150) {
      Alert.alert('Success', `Checked in at ${selectedSpot.properties.name}`);
    } else {
      Alert.alert(
        'Too far',
        `You are ${Math.round(distance)} meters away. Move closer (within 100m).`
      );
    }
  };

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location access is required.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const coords: [number, number] = [
        location.coords.longitude,
        location.coords.latitude,
      ];

      setUserCoords(coords);

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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <Mapbox.MapView
          scaleBarEnabled={false}
          compassEnabled={true}
          compassPosition={{ top: 25, right: 25 }}
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
            shape={EXPLORER_SPOTS}
            hitbox={{ width: 44, height: 44 }}
            onPress={async (event) => {
              const feature = event.features?.[0] as SpotFeature | undefined;
              if (!feature) return;

              setSelectedSpot(feature);

              await AsyncStorage.setItem(
                'last_viewed_spot',
                JSON.stringify(feature)
              );

              bottomSheetRef.current?.snapToIndex(1);

              cameraRef.current?.flyTo(feature.geometry.coordinates, 800);
            }}
          >
            <Mapbox.CircleLayer
              id="spots-layer"
              style={{
                circleRadius: 25,
                circleColor: '#FB923C',
                circleOpacity: 0.5,
                circleBlur: 0.8,
              }}
            />

            <Mapbox.CircleLayer
              id="selected-layer"
              filter={['==', ['get', 'id'], selectedSpot?.properties.id ?? '']}
              style={{
                circleRadius: 35,
                circleColor: '#FFFBEB',
                circleOpacity: 0.3,
                circleBlur: 1,
              }}
            />
          </Mapbox.ShapeSource>

          <Mapbox.Camera
            ref={cameraRef}
            defaultSettings={{
              centerCoordinate: NYC_COORDS,
              zoomLevel: 14,
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

        <BottomSheet
          ref={bottomSheetRef}
          index={0}
          snapPoints={snapPoints}
          backgroundStyle={styles.sheetBackground}
          onChange={(index) => setSheetIndex(index)}
          onAnimate={(fromIndex, toIndex) => setSheetIndex(toIndex)}
        >
          <BottomSheetView style={styles.contentContainer}>
            {selectedSpot ? (
              <>
                <Text style={styles.title}>
                  {selectedSpot.properties.name} 🧭
                </Text>
                <Text style={styles.subtitle}>
                  {selectedSpot.properties.vibe}
                </Text>

                <View style={styles.spotCard}>
                  <Text style={styles.vibeText}>
                    Density: {Math.round(selectedSpot.properties.intensity * 100)}%
                  </Text>

                  <TouchableOpacity
                    style={styles.checkInButton}
                    onPress={handleCheckIn}
                  >
                    <Text style={styles.buttonText}>Check In</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.title}>Explore 🗺️</Text>
                <Text style={styles.subtitle}>
                  Tap a glow to reveal the vibe
                </Text>
              </>
            )}
          </BottomSheetView>
        </BottomSheet>
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
  subtitle: { fontSize: 16, fontWeight: '500', color: '#6B7280', marginBottom: 15},
  spotCard: {
    marginTop: 20,
    width: '100%',
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 15
  },
  vibeText: { fontSize: 16, fontWeight: '600' },
  checkInButton: {
    marginTop: 15,
    backgroundColor: '#FB923C',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: { color: 'white', fontWeight: 'bold' },
  floatingButton: {
    position: 'absolute',
    right: 20,
    backgroundColor: 'white',
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
});