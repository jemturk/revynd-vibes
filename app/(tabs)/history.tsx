import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Modal,
  Pressable
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { FadeInDown, FadeOutDown, FadeOutLeft, LinearTransition } from 'react-native-reanimated';
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
  
  // Archiving and Multi-select states
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Confirmation Modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'single' | 'batch' | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const API_URL = 'https://revynd-api-939729691035.us-east1.run.app';
  const swipeableRefs = useRef<{ [key: number]: Swipeable | null }>({});

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
      paddingTop: 45,
      paddingHorizontal: 20,
      paddingBottom: 20,
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      marginBottom: 20,
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerTitle: { fontSize: 26, fontWeight: '800', color: theme.text },
    headerSubtitle: { fontSize: 13, color: theme.subtext, marginTop: 4, fontWeight: '500' },
    selectButton: {
      paddingVertical: 6,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: theme.border,
    },
    selectButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.primary,
    },
    batchHeaderActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
    },
    batchActionLink: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.primary,
    },
    tabsContainer: {
      flexDirection: 'row',
      marginTop: 16,
      backgroundColor: theme.border,
      borderRadius: 12,
      padding: 4,
    },
    tab: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 8,
    },
    activeTab: {
      backgroundColor: theme.card,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.subtext,
    },
    activeTabText: {
      color: theme.text,
      fontWeight: '700',
    },
    listContent: { paddingBottom: 120 },
    historyCard: {
      backgroundColor: theme.card,
      borderRadius: 20,
      paddingVertical: 20,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: theme.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    checkboxWrapper: {
      marginRight: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    iconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    spotName: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
    },
    vibeType: { fontSize: 13, color: theme.subtext, marginTop: 2 },
    timeText: {
      fontSize: 11,
      color: theme.subtext,
      marginTop: 6,
      fontWeight: '600',
    },
    intensityWrapper: { alignItems: 'flex-end', marginLeft: 10 },
    miniBarTrack: {
      width: 36,
      height: 6,
      backgroundColor: theme.border,
      borderRadius: 3,
      overflow: 'hidden',
    },
    miniBarFill: { height: '100%', backgroundColor: '#FB923C' },
    emptyState: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: theme.subtext, marginTop: 12, fontSize: 16, fontWeight: '500' },
    itemWrapper: {
      marginBottom: 12,
      marginHorizontal: 21,
    },
    shadowWrapper: {
      shadowColor: theme.text,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    // Swipe action styles
    actionsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: 12,
      height: '100%',
    },
    actionButton: {
      justifyContent: 'center',
      alignItems: 'center',
      width: 72,
      height: '100%',
      borderRadius: 16,
      marginLeft: 8,
    },
    actionText: {
      color: 'white',
      fontWeight: '700',
      fontSize: 11,
      marginTop: 4,
    },
    // Bottom Action Drawer
    bottomDrawer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.card,
      borderTopWidth: 1,
      borderColor: theme.border,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 24,
      paddingTop: 20,
      paddingBottom: 35,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 20,
    },
    drawerCountText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.subtext,
      textAlign: 'center',
      marginBottom: 16,
    },
    drawerButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    drawerButton: {
      flex: 1,
      flexDirection: 'row',
      height: 48,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
    },
    drawerButtonText: {
      color: 'white',
      fontSize: 14,
      fontWeight: '700',
    },
    archiveButton: { backgroundColor: '#F97316' },
    restoreButton: { backgroundColor: '#10B981' },
    deleteButton: { backgroundColor: '#EF4444' },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContainer: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: theme.card,
      borderRadius: 22,
      padding: 24,
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
      elevation: 16,
    },
    modalTitle: { fontSize: 20, fontWeight: '700', color: theme.text, marginBottom: 12 },
    modalMessage: { fontSize: 15, color: theme.subtext, lineHeight: 22, marginBottom: 24 },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
    modalButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalCancelButton: {
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
      marginRight: 12,
    },
    modalDeleteButton: { backgroundColor: '#ef4444' },
    modalCancelText: { color: theme.text, fontSize: 15, fontWeight: '600' },
    modalDeleteText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  }), [theme]);

  const buildAuthHeaders = useCallback(async (contentType?: string) => {
    const token = await SecureStore.getItemAsync('user_token');
    return {
      Accept: 'application/json',
      ...(contentType ? { 'Content-Type': contentType } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, []);

  const fetchHistory = useCallback(async (archivedParam: boolean): Promise<CheckInRecord[]> => {
    try {
      const response = await fetch(`${API_URL}/api/checkins/history?archived=${archivedParam}`, {
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
  }, [buildAuthHeaders]);

  const loadHistory = useCallback((tab: 'active' | 'archived', showLoading = true) => {
    if (showLoading) {
      setLoading(true);
      setHistory([]);
    }
    fetchHistory(tab === 'archived').then(setHistory);
  }, [fetchHistory]);

  useFocusEffect(
    useCallback(() => {
      loadHistory(activeTab, history.length === 0);
      return () => {};
    }, [activeTab, loadHistory, history.length])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHistory(activeTab === 'archived').then(setHistory);
  }, [activeTab, fetchHistory]);

  const handleTabChange = (tab: 'active' | 'archived') => {
    setActiveTab(tab);
    setHistory([]);
    setLoading(true);
  };

  // Single Item API Operations
  const deleteCheckIn = async (id: number) => {
    const response = await fetch(`${API_URL}/api/checkins/history/${id}`, {
      method: 'DELETE',
      headers: await buildAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to delete history item');
    }
  };

  const archiveCheckIn = async (id: number) => {
    const response = await fetch(`${API_URL}/api/checkins/history/${id}/archive`, {
      method: 'PUT',
      headers: await buildAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to archive history item');
    }
  };

  const restoreCheckIn = async (id: number) => {
    const response = await fetch(`${API_URL}/api/checkins/history/${id}/unarchive`, {
      method: 'PUT',
      headers: await buildAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to restore history item');
    }
  };

  // Batch API Operations
  const batchArchive = async (ids: number[]) => {
    const response = await fetch(`${API_URL}/api/checkins/history/batch-archive`, {
      method: 'POST',
      headers: await buildAuthHeaders('application/json'),
      body: JSON.stringify(ids),
    });
    if (!response.ok) throw new Error('Failed to batch archive');
  };

  const batchRestore = async (ids: number[]) => {
    const response = await fetch(`${API_URL}/api/checkins/history/batch-unarchive`, {
      method: 'POST',
      headers: await buildAuthHeaders('application/json'),
      body: JSON.stringify(ids),
    });
    if (!response.ok) throw new Error('Failed to batch restore');
  };

  const batchDelete = async (ids: number[]) => {
    const response = await fetch(`${API_URL}/api/checkins/history/batch-delete`, {
      method: 'POST',
      headers: await buildAuthHeaders('application/json'),
      body: JSON.stringify(ids),
    });
    if (!response.ok) throw new Error('Failed to batch delete');
  };

  // Single Handlers
  const handleDelete = (id: number) => {
    swipeableRefs.current[id]?.close();
    setPendingDeleteId(id);
    setDeleteMode('single');
    setShowDeleteModal(true);
  };

  const handleArchive = async (id: number) => {
    swipeableRefs.current[id]?.close();

    setTimeout(async () => {
      const previous = history;
      setHistory(prev => prev.filter(item => item.id !== id));

      try {
        await archiveCheckIn(id);
        delete swipeableRefs.current[id];
      } catch (error) {
        setHistory(previous);
        Alert.alert('Error', 'Could not archive item.');
      }
    }, 200);
  };

  const handleRestore = async (id: number) => {
    swipeableRefs.current[id]?.close();

    setTimeout(async () => {
      const previous = history;
      setHistory(prev => prev.filter(item => item.id !== id));

      try {
        await restoreCheckIn(id);
        delete swipeableRefs.current[id];
      } catch (error) {
        setHistory(previous);
        Alert.alert('Error', 'Could not restore item.');
      }
    }, 200);
  };

  // Selection & Batch Handlers
  const toggleSelectItem = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === history.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(history.map(item => item.id)));
    }
  };

  const handleBatchArchive = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const previous = history;
    setHistory(prev => prev.filter(item => !selectedIds.has(item.id)));
    setIsSelectMode(false);
    setSelectedIds(new Set());

    try {
      await batchArchive(ids);
    } catch (error) {
      setHistory(previous);
      Alert.alert('Error', 'Failed to archive selected items.');
    }
  };

  const handleBatchRestore = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const previous = history;
    setHistory(prev => prev.filter(item => !selectedIds.has(item.id)));
    setIsSelectMode(false);
    setSelectedIds(new Set());

    try {
      await batchRestore(ids);
    } catch (error) {
      setHistory(previous);
      Alert.alert('Error', 'Failed to restore selected items.');
    }
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    setDeleteMode('batch');
    setShowDeleteModal(true);
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setPendingDeleteId(null);
    setDeleteMode(null);
  };

  const confirmDelete = async () => {
    setShowDeleteModal(false);

    if (deleteMode === 'single' && pendingDeleteId !== null) {
      const id = pendingDeleteId;
      const previous = history;
      setHistory(prev => prev.filter(item => item.id !== id));

      try {
        await deleteCheckIn(id);
        delete swipeableRefs.current[id];
      } catch (error) {
        setHistory(previous);
        Alert.alert('Error', 'Could not delete from server.');
      } finally {
        setPendingDeleteId(null);
        setDeleteMode(null);
      }
    } else if (deleteMode === 'batch') {
      const ids = Array.from(selectedIds);
      const previous = history;
      setHistory(prev => prev.filter(item => !selectedIds.has(item.id)));
      setIsSelectMode(false);
      setSelectedIds(new Set());

      try {
        await batchDelete(ids);
      } catch (error) {
        setHistory(previous);
        Alert.alert('Error', 'Failed to delete selected items.');
      } finally {
        setDeleteMode(null);
      }
    }
  };

  // Reset selection when changing tabs or select mode toggled off
  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeTab, isSelectMode]);

  const renderRightActions = (item: CheckInRecord) => {
    if (isSelectMode) return null;
    const isArchived = activeTab === 'archived';

    return (
      <View style={styles.actionsContainer}>
        {isArchived ? (
          <TouchableOpacity
            onPress={() => handleRestore(item.id)}
            style={[styles.actionButton, styles.restoreButton]}
          >
            <MaterialIcons name="unarchive" size={24} color="white" />
            <Text style={styles.actionText}>Restore</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => handleArchive(item.id)}
            style={[styles.actionButton, styles.archiveButton]}
          >
            <MaterialIcons name="archive" size={24} color="white" />
            <Text style={styles.actionText}>Archive</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => handleDelete(item.id)}
          style={[styles.actionButton, styles.deleteButton]}
        >
          <MaterialIcons name="delete-sweep" size={24} color="white" />
          <Text style={styles.actionText}>Delete</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderItem = ({ item }: { item: CheckInRecord }) => {
    const timeStr = item.checkInTime && !item.checkInTime.endsWith('Z') ? `${item.checkInTime}Z` : item.checkInTime;
    const date = new Date(timeStr);
    const percentage = Number(item.intensityAtTime) * 100;
    const isSelected = selectedIds.has(item.id);

    return (
      <Animated.View
        exiting={FadeOutLeft.duration(300)}
        layout={LinearTransition.springify().damping(50)}
        style={styles.itemWrapper}
      >
        <Swipeable
          ref={(ref) => { swipeableRefs.current[item.id] = ref; }}
          renderRightActions={() => renderRightActions(item)}
          enabled={!isSelectMode}
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
            }, 2500);
          }}
        >
          <TouchableOpacity
            activeOpacity={isSelectMode ? 0.8 : 1}
            onPress={() => isSelectMode ? toggleSelectItem(item.id) : null}
            style={styles.shadowWrapper}
          >
            <View style={[
              styles.historyCard,
              isSelected && { borderColor: theme.primary, backgroundColor: theme.cardLighter }
            ]}>
              {isSelectMode && (
                <View style={styles.checkboxWrapper}>
                  <MaterialIcons
                    name={isSelected ? 'check-circle' : 'radio-button-unchecked'}
                    size={24}
                    color={isSelected ? theme.primary : theme.subtext}
                  />
                </View>
              )}
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
          </TouchableOpacity>
        </Swipeable>
      </Animated.View >
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={history}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Text style={styles.headerTitle}>Visited Spots 🛹</Text>
              <TouchableOpacity
                style={styles.selectButton}
                onPress={() => setIsSelectMode(!isSelectMode)}
              >
                <Text style={styles.selectButtonText}>
                  {isSelectMode ? 'Cancel' : 'Select'}
                </Text>
              </TouchableOpacity>
            </View>

            {isSelectMode ? (
              <View style={styles.batchHeaderActions}>
                <TouchableOpacity onPress={handleSelectAll}>
                  <Text style={styles.batchActionLink}>
                    {selectedIds.size === history.length ? 'Deselect All' : 'Select All'}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.headerSubtitle}>
                  {selectedIds.size} selected
                </Text>
              </View>
            ) : (
              <Text style={styles.headerSubtitle}>
                {history.length} check-ins total
              </Text>
            )}

            <View style={styles.tabsContainer}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'active' && styles.activeTab]}
                onPress={() => handleTabChange('active')}
              >
                <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>
                  Active
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'archived' && styles.activeTab]}
                onPress={() => handleTabChange('archived')}
              >
                <Text style={[styles.tabText, activeTab === 'archived' && styles.activeTabText]}>
                  Archived
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ marginTop: 100, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <MaterialIcons name="history" size={48} color={theme.subtext} />
              <Text style={styles.emptyText}>
                {activeTab === 'archived' ? 'No archived check-ins.' : 'No check-ins yet.'}
              </Text>
            </View>
          )
        }
      />

      {isSelectMode && selectedIds.size > 0 && (
        <Animated.View
          entering={FadeInDown.springify().damping(20).stiffness(150)}
          exiting={FadeOutDown.duration(200)}
          style={styles.bottomDrawer}
        >
          <Text style={styles.drawerCountText}>
            {selectedIds.size} {selectedIds.size === 1 ? 'item' : 'items'} selected
          </Text>
          <View style={styles.drawerButtons}>
            {activeTab === 'archived' ? (
              <TouchableOpacity
                style={[styles.drawerButton, styles.restoreButton]}
                onPress={handleBatchRestore}
              >
                <MaterialIcons name="unarchive" size={20} color="white" />
                <Text style={styles.drawerButtonText}>Restore</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.drawerButton, styles.archiveButton]}
                onPress={handleBatchArchive}
              >
                <MaterialIcons name="archive" size={20} color="white" />
                <Text style={styles.drawerButtonText}>Archive</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.drawerButton, styles.deleteButton]}
              onPress={handleBatchDelete}
            >
              <MaterialIcons name="delete" size={20} color="white" />
              <Text style={styles.drawerButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={cancelDelete}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Delete check-in?</Text>
            <Text style={styles.modalMessage}>
              {deleteMode === 'batch'
                ? `Are you sure you want to permanently delete these ${selectedIds.size} check-ins? This action cannot be undone.`
                : 'Are you sure you want to permanently delete this check-in? This action cannot be undone.'}
            </Text>
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={cancelDelete}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalDeleteButton]}
                onPress={confirmDelete}
              >
                <Text style={styles.modalDeleteText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default HistoryScreen;