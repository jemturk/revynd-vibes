import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function SpotDetailScreen() {
  const { id } = useLocalSearchParams(); // Grabs the "123" from /spot/123

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Spot ID: {id}</Text>
      <Text style={styles.subtitle}>Analyzing the Vibe...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#FFFBEB' },
  title: { fontSize: 24, fontWeight: 'bold' },
  subtitle: { fontSize: 16, color: '#666' }
});