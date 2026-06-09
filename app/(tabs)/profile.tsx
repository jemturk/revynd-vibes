import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Modal, Pressable, Alert, Image, ActivityIndicator, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme, AppTheme } from '../../theme/ThemeContext';
import { useAuth } from '../_layout';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';

type AccountItemProps = {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  destructive?: boolean;
  color?: string;
  styles: any; // Passed directly from parent matrix to maximize caching performance
};

// Re-declare the isolated Account Row item with optimized stylesheet reuse
const AccountItem = ({ icon, label, onPress, rightElement, destructive, color, styles }: AccountItemProps) => {
  const { theme } = useTheme();
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

export default function AccountScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
  const { user, signIn, signOut } = useAuth();

  // FIXED: Wrapped stylesheet creation inside useMemo to completely eliminate layout regeneration overhead
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editErrorMessage, setEditErrorMessage] = useState<string | null>(null);
  const [updatingProfile, setUpdatingProfile] = useState(false);

  const API_URL = 'https://revynd-api-939729691035.us-east1.run.app';

  const pickImage = () => {
    setShowPhotoModal(true);
  };

  const buildAuthHeaders = async (contentType?: string) => {
    const token = await SecureStore.getItemAsync('user_token');
    return {
      Accept: 'application/json',
      ...(contentType ? { 'Content-Type': contentType } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const handleImageAction = async (action: 'camera' | 'library') => {
    try {
      let result;
      const options = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1] as [number, number],
        quality: 0.4,
        base64: true,
      };

      if (action === 'camera') {
        const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
        if (!cameraPermission.granted) {
          Alert.alert('Permission Denied', 'Camera access is required to take a profile picture.');
          return;
        }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        const libraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!libraryPermission.granted) {
          Alert.alert('Permission Denied', 'Media library access is required to choose a profile picture.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      setUploading(true);
      const asset = result.assets[0];
      const base64Str = `data:image/jpeg;base64,${asset.base64}`;

      const response = await fetch(`${API_URL}/api/auth/profile-picture`, {
        method: 'PUT',
        headers: await buildAuthHeaders('application/json'),
        body: JSON.stringify({ profilePicture: base64Str }),
      });

      const raw = await response.text();
      let payload: any = {};
      try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = { message: raw?.trim() } }

      if (!response.ok) {
        const msg = payload?.message || `Upload failed (${response.status}).`;
        Alert.alert('Upload Failed', msg);
        return;
      }

      if (user) {
        signIn({
          ...user,
          profilePicture: base64Str,
        });
      }

      setSuccessMessage('Profile picture updated successfully!');
    } catch (error) {
      console.error('Image picking/upload error:', error);
      Alert.alert('Error', 'An unexpected error occurred while picking or uploading your image.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async () => {
    try {
      setUploading(true);

      const response = await fetch(`${API_URL}/api/auth/profile-picture`, {
        method: 'PUT',
        headers: await buildAuthHeaders('application/json'),
        body: JSON.stringify({ profilePicture: "" }),
      });

      const raw = await response.text();
      let payload: any = {};
      try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = { message: raw?.trim() } }

      if (!response.ok) {
        const msg = payload?.message || `Failed to remove photo (${response.status}).`;
        Alert.alert('Error', msg);
        return;
      }

      if (user) {
        signIn({
          ...user,
          profilePicture: "",
        });
      }

      setSuccessMessage('Profile picture removed successfully!');
    } catch (error) {
      console.error('Delete photo error:', error);
      Alert.alert('Error', 'An unexpected error occurred while deleting your profile picture.');
    } finally {
      setUploading(false);
    }
  };

  const handleSignOut = async () => {
    signOut();
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

      await SecureStore.setItemAsync('account_deleted_banner', 'true');
      signOut();
    } catch (error) {
      console.error('Delete account failed', error);
      setDeleteErrorMessage('Unable to delete account. Please try again later.');
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      setEditErrorMessage('Name is required.');
      return;
    }
    if (editName.trim().length < 3) {
      setEditErrorMessage('Name must be at least 3 characters long.');
      return;
    }

    setUpdatingProfile(true);
    setEditErrorMessage(null);

    try {
      const response = await fetch(`${API_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: await buildAuthHeaders('application/json'),
        body: JSON.stringify({ name: editName.trim() }),
      });

      const raw = await response.text();
      let payload: any = {};
      try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = { message: raw?.trim() } }

      if (!response.ok) {
        const msg = payload?.message || `Failed to update profile (${response.status}).`;
        setEditErrorMessage(msg);
        return;
      }

      if (user) {
        signIn({
          ...user,
          name: payload.name || editName.trim(),
        });
      }

      setShowEditModal(false);
      setSuccessMessage('Profile updated successfully!');
    } catch (error) {
      console.error('Update profile error:', error);
      setEditErrorMessage('Unable to save changes. Please try again later.');
    } finally {
      setUpdatingProfile(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.avatarWrapper}
          onPress={pickImage}
          disabled={uploading}
          activeOpacity={0.8}
        >
          <View style={styles.avatar}>
            {uploading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : user?.profilePicture ? (
              <Image source={{ uri: user.profilePicture }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </Text>
            )}
          </View>
          <View style={styles.editBadge}>
            <MaterialIcons name="photo-camera" size={14} color="#fff" />
          </View>
        </TouchableOpacity>
        <Text style={styles.userName}>{user?.name || "Active Session"}</Text>
        <Text style={styles.userEmail}>{user?.email || "No Email Session Linked"}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Settings</Text>
        <AccountItem
          icon="brightness-6"
          label="Dark Mode"
          styles={styles}
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
        <AccountItem icon="notifications-none" label="Notifications" styles={styles} onPress={() => { }} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <AccountItem 
          icon="person-outline" 
          label="Edit Profile" 
          styles={styles} 
          onPress={() => {
            setEditName(user?.name || '');
            setEditErrorMessage(null);
            setShowEditModal(true);
          }} 
        />
        <AccountItem icon="security" label="Privacy Policy" styles={styles} onPress={() => { }} />
        <AccountItem icon="exit-to-app" label="Sign Out" styles={styles} onPress={handleSignOut} color="#fb923c" />
        <AccountItem icon="delete" label="Delete Account" styles={styles} onPress={handleDeleteAccount} destructive />
      </View>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowEditModal(false);
          setEditErrorMessage(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <Text style={styles.modalMessage}>
              Update your display name below.
            </Text>

            {editErrorMessage ? (
              <Text style={{ color: '#ef4444', marginBottom: 12, fontWeight: '600', fontSize: 14 }}>
                {editErrorMessage}
              </Text>
            ) : null}

            <TextInput
              style={{
                padding: 14,
                borderRadius: 12,
                fontSize: 16,
                backgroundColor: theme.background,
                color: theme.text,
                borderWidth: 1,
                borderColor: theme.border,
                marginBottom: 20,
                width: '100%'
              }}
              placeholder="Display Name"
              placeholderTextColor={theme.subtext}
              value={editName}
              onChangeText={setEditName}
              autoCapitalize="words"
            />

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.modalCancelButton]}
                disabled={updatingProfile}
                onPress={() => {
                  setShowEditModal(false);
                  setEditErrorMessage(null);
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalButton,
                  { backgroundColor: '#FB923C' }
                ]}
                disabled={updatingProfile}
                onPress={handleSaveProfile}
              >
                {updatingProfile ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Profile Picture Option Drawer Modal */}
      <Modal
        visible={showPhotoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhotoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Profile Picture</Text>
            <Text style={styles.modalMessage}>
              Update or remove your profile picture.
            </Text>

            <TouchableOpacity
              style={styles.photoOptionButton}
              onPress={() => {
                setShowPhotoModal(false);
                handleImageAction('camera');
              }}
            >
              <MaterialIcons name="photo-camera" size={20} color={theme.text} style={styles.photoOptionIcon} />
              <Text style={styles.photoOptionText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.photoOptionButton}
              onPress={() => {
                setShowPhotoModal(false);
                handleImageAction('library');
              }}
            >
              <MaterialIcons name="photo-library" size={20} color={theme.text} style={styles.photoOptionIcon} />
              <Text style={styles.photoOptionText}>Choose from Library</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.photoOptionButton,
                !(user?.profilePicture && user.profilePicture !== "") && styles.photoOptionDisabledButton
              ]}
              disabled={!(user?.profilePicture && user.profilePicture !== "")}
              onPress={() => {
                setShowPhotoModal(false);
                handleDeletePhoto();
              }}
            >
              <MaterialIcons
                name="delete-outline"
                size={20}
                color={(user?.profilePicture && user.profilePicture !== "") ? '#ef4444' : theme.subtext}
                style={styles.photoOptionIcon}
              />
              <Text style={[
                styles.photoOptionText,
                (user?.profilePicture && user.profilePicture !== "") ? styles.photoOptionDeleteText : styles.photoOptionDisabledText
              ]}>
                Delete Photo
              </Text>
            </TouchableOpacity>

            {/* FIXED: Removed flex expansion and added theme-compliant neutral cancel styling */}
            <View style={{ marginTop: 14, flexDirection: 'row' }}>
              <Pressable
                style={[
                  styles.modalButton,
                  {
                    backgroundColor: '#FB923C', // Revynd Orange background
                    marginRight: 0
                  }
                ]}
                onPress={() => setShowPhotoModal(false)}
              >
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
                  Cancel
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Account Deletion Confirmation Modal */}
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

      {/* Error Output Modal Banner */}
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

      {/* Success Notification Banner */}
      <Modal
        visible={Boolean(successMessage)}
        transparent
        animationType="fade"
        onRequestClose={() => setSuccessMessage(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              {/* FIXED: Swapped the icon color to match the teal theme as well */}
              <MaterialIcons name="check-circle" size={50} color="#0D9488" />
            </View>
            <Text style={[styles.modalTitle, { textAlign: 'center' }]}>Success</Text>
            <Text style={[styles.modalMessage, { textAlign: 'center', marginBottom: 20 }]}>{successMessage}</Text>
            <View style={styles.modalButtons}>
              <Pressable
                style={[
                  styles.modalButton,
                  {
                    backgroundColor: '#0D9488', // FIXED: Now uses the index page check-in Teal
                    marginRight: 0
                  }
                ]}
                onPress={() => setSuccessMessage(null)}
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
}

// Stylesheet generator factory function unchanged
const makeStyles = (theme: AppTheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: theme.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  avatarWrapper: { marginBottom: 16, position: 'relative' },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.primary || '#FB923C',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
  editBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FB923C',
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.card,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
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
  photoOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 10,
    width: '100%',
  },
  photoOptionDisabledButton: { opacity: 0.4 },
  photoOptionIcon: { marginRight: 12 },
  photoOptionText: { fontSize: 16, fontWeight: '600', color: theme.text },
  photoOptionDisabledText: { color: theme.subtext },
  photoOptionDeleteText: { color: '#ef4444' },
  versionText: {
    textAlign: 'center',
    color: theme.subtext,
    fontSize: 12,
    marginTop: 40,
    marginBottom: 20,
  },
});