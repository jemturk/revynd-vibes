import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Modal, Pressable, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme, AppTheme } from '../../theme/ThemeContext';
import { useAuth } from '../_layout'; 
import * as SecureStore from 'expo-secure-store';

type AccountItemProps = {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  destructive?: boolean;
  color?: string;
};

// Re-declare the isolated Account Row item
const AccountItem = ({ icon, label, onPress, rightElement, destructive, color }: AccountItemProps) => {
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  const dangerColor = '#ef4444';
  const accentColor = color ?? (destructive ? dangerColor : theme.subtext);

  return (
    <TouchableOpacity style={styles.item} onPress={onPress} disabled={!onPress}>
      <View style={styles.itemLeft}>
        <View style={styles.iconWrapper}>
          <MaterialIcons name={icon} size={22} color={accentColor} />
        </View>
        <Text style={[styles.itemLabel, { color: accentColor }]}>{label}</Text>
      </View>
      {rightElement ?? <MaterialIcons name="chevron-right" size={24} color={theme.border} />}
    </TouchableOpacity>
  );
};

const AccountScreen = () => {
  const { theme, isDark, toggleTheme } = useTheme();
  const { user, signOut } = useAuth(); 
  const styles = makeStyles(theme);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = React.useState<string | null>(null);

  const API_URL = 'https://revynd-api-939729691035.us-east1.run.app';

  const buildAuthHeaders = async (contentType?: string) => {
    const token = await SecureStore.getItemAsync('user_token');
    return {
      Accept: 'application/json',
      ...(contentType ? { 'Content-Type': contentType } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  // 🔒 1. Custom Secure Sign Out Handler
  const handleSignOut = async () => {
    try {
      // Clear out the user tracking parameters to avoid data bleeding between profiles
      await SecureStore.deleteItemAsync('userId');
      await SecureStore.deleteItemAsync('user_token');
    } catch (error) {
      console.error('Error clearing local cache tokens during sign out:', error);
    } finally {
      // Always trigger the navigation context switch 
      signOut();
    }
  };

  const handleDeleteAccount = () => {
    if (!user?.email) {
      Alert.alert('Error', 'No signed-in account found.');
      return;
    }

    setShowDeleteModal(true);
  };

  const confirmDeleteAccount = async () => {
    setShowDeleteModal(false);

    if (!user?.email) {
      Alert.alert('Error', 'No signed-in account found.');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/delete`, {
        method: 'POST',
        headers: await buildAuthHeaders('application/json'),
        body: JSON.stringify({ email: user.email }),
      });

      const raw = await response.text();
      let payload: any = {};
      try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = { message: raw?.trim() } }

      if (!response.ok) {
        const status = response.status;
        const msg = payload?.message || raw || `Failed to delete account (${status}).`;
        setDeleteErrorMessage(msg);
        return;
      }

      // 🔒 2. Clean out user context strings if account deletion resolves successfully
      await SecureStore.deleteItemAsync('userId');
      await SecureStore.deleteItemAsync('user_token');
      signOut();
    } catch (error) {
      console.error('Delete account failed', error);
      setDeleteErrorMessage('Unable to delete account. Please try again later.');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </Text>
        </View>
        <Text style={styles.userName}>{user?.name || "Active Session"}</Text>
        <Text style={styles.userEmail}>{user?.email || "No Email Session Linked"}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Settings</Text>
        <AccountItem
          icon="brightness-6"
          label="Dark Mode"
          rightElement={
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{
                false: '#94A3B8', 
                true: '#639cec'   
              }}
              thumbColor={isDark ? '#FB923C' : '#F4F3F4'}
              ios_backgroundColor="#CBD5E1"
            />
          }
        />
        <AccountItem icon="notifications-none" label="Notifications" onPress={() => { }} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <AccountItem icon="person-outline" label="Edit Profile" onPress={() => { }} />
        <AccountItem icon="security" label="Privacy Policy" onPress={() => { }} />
        {/* Updated to trigger our custom secure cache clear method 🚀 */}
        <AccountItem icon="exit-to-app" label="Sign Out" onPress={handleSignOut} color="#fb923c" />
        <AccountItem icon="delete" label="Delete Account" onPress={handleDeleteAccount} destructive />
      </View>

      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Delete account?</Text>
            <Text style={styles.modalMessage}>
              This will permanently delete your account and all associated data. This action cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalDeleteButton]}
                onPress={confirmDeleteAccount}
              >
                <Text style={styles.modalDeleteText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(deleteErrorMessage)}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteErrorMessage(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Delete failed</Text>
            <Text style={styles.modalMessage}>{deleteErrorMessage}</Text>
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.modalDeleteButton]}
                onPress={() => setDeleteErrorMessage(null)}
              >
                <Text style={styles.modalDeleteText}>OK</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Text style={styles.versionText}>Version 1.0.4</Text>
    </ScrollView>
  );
};

// Stylesheet generator factory function
const makeStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: theme.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.primary || '#FB923C',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: { color: 'white', fontSize: 32, fontWeight: '800' },
  userName: { fontSize: 20, fontWeight: '700', color: theme.text },
  userEmail: { fontSize: 14, color: theme.subtext, marginTop: 4 },
  section: { marginTop: 24, paddingHorizontal: 16 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.subtext,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  itemLeft: { flexDirection: 'row', alignItems: 'center' },
  iconWrapper: { marginRight: 12 },
  itemLabel: { fontSize: 16, color: theme.text, fontWeight: '500' },
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
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 15,
    color: theme.subtext,
    lineHeight: 22,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
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
  modalDeleteButton: {
    backgroundColor: '#ef4444',
  },
  modalCancelText: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '600',
  },
  modalDeleteText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  versionText: {
    textAlign: 'center',
    color: theme.subtext,
    fontSize: 12,
    marginTop: 40,
    marginBottom: 20,
  },
});

export default AccountScreen;