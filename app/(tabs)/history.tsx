import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
import * as SecureStore from 'expo-secure-store';
import { useTheme } from '../../theme/ThemeContext';

interface CheckInRecord {
  id: number;
  spotName: string;
  vibeTag: string;
  checkInTime: string;
  intensityAtTime: number;
}

const HistoryScreen = () => {
  const { theme } = useTheme();
  const [history, setHistory] = useState<CheckInRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const API_URL = 'https://revynd-api-939729691035.us-east1.run.app';

  const swipeableRefs = useRef<{ [key: number]: Swipeable | null }>({});

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
      paddingTop: 40,
      paddingHorizontal: 20,
      paddingBottom: 20,
      backgroundColor: theme.card,
    },
    headerTitle: { fontSize: 28, fontWeight: '800', color: theme.text },
    headerSubtitle: { fontSize: 14, color: theme.subtext, marginTop: 4 },
    listContent: { paddingHorizontal: 5, paddingVertical: 25 },
    historyCard: {
      backgroundColor: theme.card,
      borderRadius: 20,
      paddingVertical: 20,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: theme.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    iconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 14,
    },
    spotName: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.text
    },
    vibeType: { fontSize: 13, color: theme.subtext, marginTop: 2 },
    timeText: {
      fontSize: 11,
      color: theme.subtext,
      marginTop: 6,
      fontWeight: '600',
    },
    intensityWrapper: { alignItems: 'flex-end' },
    miniBarTrack: {
      width: 40,
      height: 6,
      backgroundColor: theme.border,
      borderRadius: 3,
      overflow: 'hidden',
    },
    miniBarFill: { height: '100%', backgroundColor: '#FB923C' },
    emptyState: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: theme.subtext, marginTop: 12, fontSize: 16 },
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
      marginBottom: 12,
      marginHorizontal: 16,
    },
    shadowWrapper: {
      shadowColor: theme.text,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
  }), [theme]);

  const buildAuthHeaders = async (contentType?: string) => {
    const token = await SecureStore.getItemAsync('user_token');
    return {
      Accept: 'application/json',
      ...(contentType ? { 'Content-Type': contentType } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const fetchHistory = async (): Promise<CheckInRecord[]> => {
    if (history.length === 0) {
      setLoading(true);
    }

    try {
      const response = await fetch(`${API_URL}/api/checkins/history`, {
        headers: await buildAuthHeaders(),
      });

      const rawText = await response.text();
      let data: any = [];

      if (rawText) {
        try {
          data = JSON.parse(rawText);
        } catch (jsonError) {
          console.error('History payload parse failed:', jsonError);
          if (!response.ok) {
            return [];
          }
          throw new Error('Invalid history response format.');
        }
      }

      if (!response.ok) {
        console.error('History fetch failed with status', response.status, data?.message || rawText);
        return [];
      }

      if (!Array.isArray(data)) {
        console.error('Unexpected history payload shape:', data);
        return [];
      }

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
      fetchHistory().then(setHistory);
      return () => {};
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHistory().then(setHistory);
  }, []);

  const deleteCheckIn = async (id: number) => {
    const response = await fetch(`${API_URL}/api/checkins/history/${id}`, {
      method: 'DELETE',
      headers: await buildAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to delete history item');
    }
  };

  const handleDelete = async (id: number) => {
    swipeableRefs.current[id]?.close();

    setTimeout(async () => {
      const previous = history;
      setHistory(prev => prev.filter(item => item.id !== id));

      try {
        await deleteCheckIn(id);
        delete swipeableRefs.current[id];
      } catch (error) {
        setHistory(previous);
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

  const renderItem = ({ item }: { item: CheckInRecord }) => {
    // Append 'Z' to treat the timezone-naive ISO string from the backend as UTC,
    // so that the client parses it as UTC and displays it in the user's local timezone.
    const timeStr = item.checkInTime && !item.checkInTime.endsWith('Z') ? `${item.checkInTime}Z` : item.checkInTime;
    const date = new Date(timeStr);
    const percentage = Number(item.intensityAtTime) * 100;

    return (
      <Animated.View
        exiting={FadeOutLeft.duration(300)}
        layout={LinearTransition.springify().damping(50)}
        style={styles.itemWrapper}
      >
        <Swipeable
          ref={(ref) => { swipeableRefs.current[item.id] = ref; }}
          renderRightActions={() => renderRightActions(item.id)}
          friction={2}
          rightThreshold={40}
          overshootRight={false}
          onSwipeableOpen={() => {
            Object.keys(swipeableRefs.current).forEach((key) => {
              const rowId = parseInt(key);
              if (rowId !== item.id) {
                swipeableRefs.current[rowId]?.close();
              }
            });

            setTimeout(() => {
              if (swipeableRefs.current[item.id]) {
                swipeableRefs.current[item.id]?.close();
              }
            }, 1500);
          }}
        >
          <View style={styles.shadowWrapper}>
            <View style={styles.historyCard}>
              <View style={styles.cardLeft}>
                <View style={styles.iconCircle}>
                  <MaterialIcons name="place" size={20} color={theme.subtext} />
                </View>
                <View>
                  <Text style={styles.spotName}>{item.spotName}</Text>
                  <Text style={styles.vibeType}>{item.vibeTag ? `${item.vibeTag} Vibe` : 'Checked In'}</Text>
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
                      { width: `${Math.min(Math.max(percentage, 0), 100)}%` },
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
        <ActivityIndicator size="large" color={theme.primary} />
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
            tintColor={theme.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="history" size={48} color={theme.subtext} />
            <Text style={styles.emptyText}>
              No check-ins yet.
            </Text>
          </View>
        }
      />
    </View>
  );
};

export default HistoryScreen;