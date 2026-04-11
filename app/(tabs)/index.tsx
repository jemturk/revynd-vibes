import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { StyleSheet, View, Text, Alert } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Mapbox from '@rnmapbox/maps';
import Constants from 'expo-constants';
import * as Location from 'expo-location'; // Add this

Mapbox.setAccessToken(Constants.expoConfig?.extra?.mapboxPublicToken || null);

const EXPLORER_SPOTS = {
  type: 'FeatureCollection',
  features: [
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
  ],
};

export default function MapScreen() {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['10%', '40%', '90%'], []);

  const [selectedSpot, setSelectedSpot] = useState<any>(null);

  const handlePress = useCallback((event: any) => {
    const feature = event.features[0];
    if (feature) {
      setSelectedSpot(feature.properties);
      bottomSheetRef.current?.snapToIndex(1); // Pull up to 40%
    }
  }, []);

  // State to hold the user's coordinates
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);

  useEffect(() => {
    (async () => {
      // 1. Request Permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Revynd needs location access to center the map.');
        return;
      }

      // 2. Get Initial Position
      const location = await Location.getCurrentPositionAsync({});
      setUserCoords([location.coords.longitude, location.coords.latitude]);
    })();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <Mapbox.MapView style={styles.map}
          styleURL={Mapbox.StyleURL.Light}
          logoEnabled={true}
          logoPosition={{ top: 8, left: 8 }}
          compassEnabled={true}
          compassPosition={{ top: 43, right: 43 }}
          scaleBarEnabled={false}>

          {/* Show the blue dot on the map */}
          <Mapbox.UserLocation visible={true} />

          <Mapbox.ShapeSource
            id="spotsSource"
            shape={EXPLORER_SPOTS}
            onPress={(event) => {
              const feature = event.features[0];
              if (feature) {
                // Snap the Bottom Sheet to the "Preview" level (40%)
                bottomSheetRef.current?.snapToIndex(1);
                // You can also set state here to update the text inside the sheet
              }
            }}
          >
            <Mapbox.CircleLayer
              id="spotsLayer"
              style={{
                circleRadius: 25,
                circleColor: '#FB923C', // Revynd Orange
                circleOpacity: 0.5,
                circleBlur: 0.8, // The magic property for the "Cloud" look
                circleStrokeWidth: 1,
                circleStrokeColor: '#FFFBEB',
              }}
            />
          </Mapbox.ShapeSource>

          <Mapbox.Camera
            zoomLevel={14}
            // If we have userCoords, use them; otherwise, default to Apex Downtown
            // userCoords ?? 
            centerCoordinate={[-74.0060, 40.7128]}
            animationMode="flyTo"
            animationDuration={2000}
          />

        </Mapbox.MapView>

        <BottomSheet
          ref={bottomSheetRef}
          index={0}
          snapPoints={snapPoints}
          backgroundStyle={styles.sheetBackground}
        >
          <BottomSheetView style={styles.contentContainer}>
            {selectedSpot ? (
              <>
                <Text style={styles.title}>{selectedSpot.name} 🧭</Text>
                <Text style={styles.subtitle}>{selectedSpot.vibe}</Text>

                <View style={styles.spotCard}>
                  <Text style={styles.vibeText}>Density Intensity: {Math.round(selectedSpot.intensity * 100)}%</Text>
                  <View style={styles.checkInButton}>
                    <Text style={styles.buttonText}>Check In at {selectedSpot.name}</Text>
                  </View>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.title}>Explore NYC 🗽</Text>
                <Text style={styles.subtitle}>Tap a glow to reveal the vibe.</Text>
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
  sheetBackground: { backgroundColor: '#FFFBEB' }, // Your Revynd cream color
  handle: { backgroundColor: '#D1D5DB', width: 40 },
  contentContainer: { padding: 20, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1F2937' },
  subtitle: { color: '#6B7280', marginTop: 5 },
  spotCard: {
    marginTop: 20,
    width: '100%',
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  vibeText: { fontSize: 16, fontWeight: '600' },
  checkInButton: {
    marginTop: 15,
    backgroundColor: '#FB923C',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center'
  },
  buttonText: { color: 'white', fontWeight: 'bold' }
});