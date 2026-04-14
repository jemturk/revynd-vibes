import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  RefreshControl, 
  ActivityIndicator 
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

// Using the Record structure we defined for the backend
interface CheckInRecord {
  spotName: string;
  vibe: string;
  checkInTime: string;
  intensityAtTime: number;
}

const HistoryScreen = () => {
  const [history, setHistory] = useState<CheckInRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = async () => {
    try {
      // Replace with your Fedora machine's IP
      const response = await fetch('http://192.168.1.223:8080/api/checkins/history');
      const data = await response.json();
      setHistory(data);
    } catch (error) {
      console.error("History fetch failed:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHistory();
  }, []);

  const renderItem = ({ item }: { item: CheckInRecord }) => {
    const date = new Date(item.checkInTime);
    
    return (
      <View style={styles.historyCard}>
        <View style={styles.cardLeft}>
          <View style={styles.iconCircle}>
            <MaterialIcons name="place" size={20} color="#64748B" />
          </View>
          <View>
            <Text style={styles.spotName}>{item.spotName}</Text>
            <Text style={styles.vibeType}>{item.vibe} Session</Text>
            <Text style={styles.timeText}>
              {date.toLocaleDateString()} • {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>

        {/* The Mini Density Bar we discussed */}
        <View style={styles.intensityWrapper}>
          <View style={styles.miniBarTrack}>
            <View style={[styles.miniBarFill, { width: `${item.intensityAtTime * 100}%` }]} />
          </View>
        </View>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3ca5fb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Visted Spots 🛹</Text>
        <Text style={styles.headerSubtitle}>{history.length} check-ins total</Text>
      </View>

      <FlatList
        data={history}
        renderItem={renderItem}
        keyExtractor={(item, index) => index.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3ca5fb" />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="history" size={48} color="#CBD5E1" />
            <Text style={styles.emptyText}>No sessions recorded yet.</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: 'white',
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#1E293B' },
  headerSubtitle: { fontSize: 14, color: '#64748B', marginTop: 4 },
  listContent: { padding: 16 },
  historyCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  spotName: { fontSize: 16, fontWeight: '700', color: '#334155' },
  vibeType: { fontSize: 13, color: '#64748B', marginTop: 2 },
  timeText: { fontSize: 11, color: '#94A3B8', marginTop: 6, fontWeight: '600' },
  intensityWrapper: { alignItems: 'flex-end' },
  miniBarTrack: {
    width: 40,
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  miniBarFill: { height: '100%', backgroundColor: '#FB923C' },
  emptyState: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#94A3B8', marginTop: 12, fontSize: 16 },
});

export default HistoryScreen;