import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { FadeOutLeft, LinearTransition } from 'react-native-reanimated';

interface CheckInRecord {
  id: number;
  spotName: string;
  vibe: string;
  checkInTime: string;
  intensityAtTime: number;
}

const API_URL = 'http://192.168.1.223:8080/api';

const HistoryScreen = () => {
  const [history, setHistory] = useState<CheckInRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const swipeableRefs = useRef<{ [key: number]: Swipeable | null }>({});

  const fetchHistory = async (): Promise<CheckInRecord[]> => {
    // Only show the big center spinner if the list is totally empty
    if (history.length === 0) {
      setLoading(true);
    }

    try {
      const response = await fetch(`${API_URL}/checkins/history`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('History fetch failed:', error);
      return [];
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      // This runs every time you switch to this tab
      fetchHistory().then(setHistory);

      return () => {
        // Optional: Clean up anything if the user leaves the tab
      };
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHistory().then(setHistory);
  }, []);

  const deleteCheckIn = async (id: number) => {
    const response = await fetch(`${API_URL}/checkins/history/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete history item');
    }
  };

  const handleDelete = async (id: number) => {
    // 1. Visually close the drawer first
    swipeableRefs.current[id]?.close();

    // 2. Wait for the animation (approx 200ms) BEFORE touching the state
    setTimeout(async () => {
      const previous = history;

      // 3. Update state AFTER the row has visually "reset"
      setHistory(prev => prev.filter(item => item.id !== id));

      try {
        await deleteCheckIn(id);
        delete swipeableRefs.current[id];
      } catch (error) {
        setHistory(previous); // Rollback
        Alert.alert('Error', 'Could not delete from server.');
      }
    }, 200);
  };

  const renderRightActions = (id: number) => (
    <TouchableOpacity
      onPress={() => handleDelete(id)}
      style={styles.deleteAction}
    >
      <MaterialIcons name="delete-sweep" size={28} color="white" />
      <Text style={styles.deleteActionText}>Delete</Text>
    </TouchableOpacity>
  );

  const openRowRef = useRef<Swipeable | null>(null);


  const renderItem = ({ item }: { item: CheckInRecord }) => {
    const date = new Date(item.checkInTime);

    return (
      <Animated.View
        // This handles the "Slide out" to the left when deleted
        exiting={FadeOutLeft.duration(300)}
        // This makes the other cards slide up smoothly to fill the gap
        layout={LinearTransition.springify().damping(50)}
        style={styles.itemWrapper}
      >
        <Swipeable
          ref={(ref) => (swipeableRefs.current[item.id] = ref)}
          renderRightActions={() => renderRightActions(item.id)}
          friction={2}
          rightThreshold={40}
          overshootRight={false}
          onSwipeableOpen={() => {
            // 1. Close all other rows immediately
            Object.keys(swipeableRefs.current).forEach((key) => {
              const rowId = parseInt(key);
              if (rowId !== item.id) {
                swipeableRefs.current[rowId]?.close();
              }
            });

            // 2. Set the auto-close timer for THIS specific row
            // We don't clear the timer here because we want it to run its course
            setTimeout(() => {
              if (swipeableRefs.current[item.id]) {
                swipeableRefs.current[item.id]?.close();
              }
            }, 1500); // 3 seconds
          }}
        >
          <View style={styles.shadowWrapper}>
            <View style={styles.historyCard}>
              <View style={styles.cardLeft}>
                <View style={styles.iconCircle}>
                  <MaterialIcons name="place" size={20} color="#64748B" />
                </View>
                <View>
                  <Text style={styles.spotName}>{item.spotName}</Text>
                  <Text style={styles.vibeType}>{item.vibe} Session</Text>
                  <Text style={styles.timeText}>
                    {date.toLocaleDateString()} •{' '}
                    {date.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>

              <View style={styles.intensityWrapper}>
                <View style={styles.miniBarTrack}>
                  <View
                    style={[
                      styles.miniBarFill,
                      { width: `${item.intensityAtTime * 100}%` },
                    ]}
                  />
                </View>
              </View>
            </View>
          </View>
        </Swipeable>
      </Animated.View >
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
        <Text style={styles.headerTitle}>Visited Spots 🛹</Text>
        <Text style={styles.headerSubtitle}>
          {history.length} check-ins total
        </Text>
      </View>

      <FlatList
        data={history}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3ca5fb"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="history" size={48} color="#CBD5E1" />
            <Text style={styles.emptyText}>
              No check-ins yet.
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e2f0c6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: 40,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: 'white',
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#1E293B' },
  headerSubtitle: { fontSize: 14, color: '#64748B', marginTop: 4 },
  listContent: { paddingHorizontal: 5, paddingVertical: 25  },
  historyCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconCircle: {
    width: 48,  // Increased from 40
    height: 48, // Increased from 40
    borderRadius: 24,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  spotName: {
    fontSize: 17, // Slight bump from 16
    fontWeight: '700',
    color: '#334155'
  },
  vibeType: { fontSize: 13, color: '#64748B', marginTop: 2 },
  timeText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 6,
    fontWeight: '600',
  },
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
  deleteAction: {
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
    borderRadius: 16,
    marginLeft: 12,
  },
  deleteActionText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 12,
    marginTop: 4,
  },
  itemWrapper: {
    marginBottom: 12, // This is the space that will collapse
    marginHorizontal: 16,
  },
});

export default HistoryScreen;