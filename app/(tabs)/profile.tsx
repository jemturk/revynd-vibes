import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Modal, Pressable, Alert, Image, ActivityIndicator, TextInput, Linking, Share } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme, AppTheme } from '../../theme/ThemeContext';
import { useAuth } from '../_layout';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, Camera } from 'expo-camera';
import * as Contacts from 'expo-contacts';

import * as Crypto from 'expo-crypto';

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
  const params = useLocalSearchParams();

  // FIXED: Wrapped stylesheet creation inside useMemo to completely eliminate layout regeneration overhead
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSecondDeleteModal, setShowSecondDeleteModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editErrorMessage, setEditErrorMessage] = useState<string | null>(null);
  const [updatingProfile, setUpdatingProfile] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);

  // QR Code state
  const [showQRCodeModal, setShowQRCodeModal] = useState(false);

  // Scan QR Code state
  const [showScanner, setShowScanner] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);

  // Contacts sync state
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [isSyncingContacts, setIsSyncingContacts] = useState(false);
  const [syncedContacts, setSyncedContacts] = useState<any[]>([]);

  // Contact Sync Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[] | null>(null);

  // Friends List state
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [friendsActiveTab, setFriendsActiveTab] = useState<'friends' | 'pending'>('friends');
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);

  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notifVibePeak, setNotifVibePeak] = useState(true);
  const [notifProximity, setNotifProximity] = useState(true);
  const [notifSocial, setNotifSocial] = useState(true);

  useEffect(() => {
    const loadAndSyncSettings = async () => {
      try {
        const peak = await SecureStore.getItemAsync('notif_vibe_peak');
        const prox = await SecureStore.getItemAsync('notif_proximity');
        const soc = await SecureStore.getItemAsync('notif_social');

        if (peak !== null) setNotifVibePeak(peak !== 'false');
        if (prox !== null) setNotifProximity(prox !== 'false');
        if (soc !== null) setNotifSocial(soc !== 'false');
      } catch (err) {
        console.error('Failed to load notification settings:', err);
      }

      try {
        const token = await SecureStore.getItemAsync('user_token');
        if (!token) return;

        const response = await fetch(`${API_URL}/api/auth/me`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.notifVibePeak !== undefined) {
            setNotifVibePeak(data.notifVibePeak);
            await SecureStore.setItemAsync('notif_vibe_peak', String(data.notifVibePeak));
          }
          if (data.notifProximity !== undefined) {
            setNotifProximity(data.notifProximity);
            await SecureStore.setItemAsync('notif_proximity', String(data.notifProximity));
          }
          if (data.notifSocial !== undefined) {
            setNotifSocial(data.notifSocial);
            await SecureStore.setItemAsync('notif_social', String(data.notifSocial));
          }
        }
      } catch (err) {
        console.warn('Failed to sync settings from server (using offline cache):', err);
      }
    };
    loadAndSyncSettings();
  }, [user]);

  useEffect(() => {
    const fetchUserId = async () => {
      try {
        const id = await SecureStore.getItemAsync('userId');
        setUserId(id);
      } catch (err) {
        console.error('Failed to read userId from SecureStore:', err);
      }
    };
    fetchUserId();
  }, [user]);

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
    setShowSecondDeleteModal(false);

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

  const handleShareInvite = async () => {
    if (!userId) {
      Alert.alert('Error', 'Unable to retrieve your user ID. Please log in again.');
      return;
    }
    try {
      const inviteUrl = `${API_URL}/invite.html?referrerId=${userId}`;
      const message = `Join me on REVYND to check real-time vibes and see check-ins! Register using my invite link:\n${inviteUrl}`;
      await Share.share({
        message,
        url: inviteUrl,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleScanQRCode = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasCameraPermission(status === 'granted');
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required to scan QR codes.');
      return;
    }
    setScanning(false);
    setShowScanner(true);
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanning) return;
    setScanning(true);

    let targetId: string | null = null;
    if (data.startsWith('revynd_friend:')) {
      targetId = data.split(':')[1];
    } else if (data.includes('referrerId=')) {
      const parts = data.split('referrerId=');
      if (parts.length > 1) {
        targetId = parts[1].split('&')[0];
      }
    }

    if (targetId) {
      await sendFriendRequest(targetId);
    } else {
      Alert.alert('Invalid QR Code', 'This QR code is not a valid REVYND invite link.', [
        { text: 'OK', onPress: () => setScanning(false) }
      ]);
    }
  };

  const sendFriendRequest = async (targetId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/friends/request/${targetId}`, {
        method: 'POST',
        headers: await buildAuthHeaders('application/json'),
      });

      const raw = await response.text();
      let payload: any = {};
      try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = { message: raw?.trim() } }

      if (!response.ok) {
        Alert.alert('Request Failed', payload.message || 'Unable to send friend request.', [
          { text: 'OK', onPress: () => setScanning(false) }
        ]);
      } else {
        setShowScanner(false);
        setSuccessMessage('Friend request sent successfully!');
      }
    } catch (err) {
      console.error('Send friend request error:', err);
      Alert.alert('Error', 'An unexpected error occurred while sending the request.', [
        { text: 'OK', onPress: () => setScanning(false) }
      ]);
    }
  };

  const handleSyncContacts = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Contacts permission is required to find your friends.');
      return;
    }
    setIsSyncingContacts(true);
    setSyncedContacts([]);
    setSearchQuery('');
    setSearchResults(null);
    setShowContactsModal(true);

    try {
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Emails, Contacts.Fields.PhoneNumbers],
      });

      const hashPromises: Promise<string>[] = [];
      for (const contact of data) {
        if (contact.emails) {
          for (const e of contact.emails) {
            if (e.email) {
              const cleanEmail = e.email.trim().toLowerCase();
              hashPromises.push(
                Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, cleanEmail)
              );
            }
          }
        }
        if (contact.phoneNumbers) {
          for (const p of contact.phoneNumbers) {
            if (p.number) {
              const cleanPhone = p.number.replace(/\D/g, '');
              if (cleanPhone) {
                hashPromises.push(
                  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, cleanPhone)
                );
              }
            }
          }
        }
      }

      if (hashPromises.length === 0) {
        setIsSyncingContacts(false);
        return;
      }

      const hashes = await Promise.all(hashPromises);

      const response = await fetch(`${API_URL}/api/friends/sync`, {
        method: 'POST',
        headers: await buildAuthHeaders('application/json'),
        body: JSON.stringify(hashes),
      });

      const raw = await response.text();
      let matchedUsers: any[] = [];
      try {
        matchedUsers = raw ? JSON.parse(raw) : [];
      } catch {
        console.error('Failed to parse sync response:', raw);
      }
      setSyncedContacts(matchedUsers);
    } catch (err) {
      console.error('Sync contacts error:', err);
      Alert.alert('Error', 'Unable to sync contacts at this time.');
    } finally {
      setIsSyncingContacts(false);
    }
  };

  const handleAddFriendFromSync = async (targetUserId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/friends/request/${targetUserId}`, {
        method: 'POST',
        headers: await buildAuthHeaders('application/json'),
      });
      if (response.ok) {
        setSyncedContacts(prev =>
          prev.map(c => c.id === targetUserId ? { ...c, relationship: 'PENDING' } : c)
        );
        setSearchResults(prev =>
          prev ? prev.map(c => c.id === targetUserId ? { ...c, relationship: 'PENDING' } : c) : null
        );
      } else {
        const raw = await response.text();
        let payload: any = {};
        try { payload = raw ? JSON.parse(raw) : {}; } catch { }
        Alert.alert('Error', payload.message || 'Failed to send friend request.');
      }
    } catch (err) {
      console.error('Add friend from sync error:', err);
    }
  };

  const handleSearchFriend = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    setIsSearching(true);
    try {
      const response = await fetch(`${API_URL}/api/friends/search?query=${encodeURIComponent(searchQuery.trim())}`, {
        headers: await buildAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data);
      } else {
        Alert.alert('Search Failed', 'Unable to search for user.');
      }
    } catch (err) {
      console.error('Search error:', err);
      Alert.alert('Error', 'An unexpected error occurred during search.');
    } finally {
      setIsSearching(false);
    }
  };

  const refreshFriendsData = async () => {
    setIsLoadingFriends(true);
    try {
      const resFriends = await fetch(`${API_URL}/api/friends`, {
        headers: await buildAuthHeaders(),
      });
      const rawFriends = await resFriends.text();
      let friendsData: any[] = [];
      try { friendsData = rawFriends ? JSON.parse(rawFriends) : []; } catch { console.error('Failed to parse friends list:', rawFriends); }
      setFriendsList(friendsData);

      const resPending = await fetch(`${API_URL}/api/friends/pending`, {
        headers: await buildAuthHeaders(),
      });
      const rawPending = await resPending.text();
      let pendingData: any[] = [];
      try { pendingData = rawPending ? JSON.parse(rawPending) : []; } catch { console.error('Failed to parse pending requests:', rawPending); }
      setPendingRequests(pendingData);
    } catch (err) {
      console.error('Fetch friends data error:', err);
    } finally {
      setIsLoadingFriends(false);
    }
  };

  const handleOpenFriendsList = async () => {
    setShowFriendsModal(true);
    await refreshFriendsData();
  };

  useEffect(() => {
    if (params.openModal === 'friends') {
      setShowFriendsModal(true);
      if (params.tab === 'pending') {
        setFriendsActiveTab('pending');
      } else {
        setFriendsActiveTab('friends');
      }
      refreshFriendsData();
      // Clear parameters so the modal doesn't reopen on subsequent visits
      router.replace('/(tabs)/profile');
    }
  }, [params.openModal, params.tab]);

  const handleAcceptFriendRequest = async (requestId: number) => {
    try {
      const response = await fetch(`${API_URL}/api/friends/accept/${requestId}`, {
        method: 'POST',
        headers: await buildAuthHeaders('application/json'),
      });
      if (response.ok) {
        await refreshFriendsData();
        setSuccessMessage('Friend request accepted!');
      } else {
        Alert.alert('Error', 'Failed to accept friend request.');
      }
    } catch (err) {
      console.error('Accept friend error:', err);
    }
  };

  const handleRemoveFriend = async (friendId: number | string, friendName: string) => {
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${friendName} from your friends list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_URL}/api/friends/remove/${friendId}`, {
                method: 'DELETE',
                headers: await buildAuthHeaders('application/json'),
              });
              if (response.ok) {
                await refreshFriendsData();
                setSuccessMessage(`${friendName} removed.`);
              } else {
                Alert.alert('Error', 'Failed to remove friend.');
              }
            } catch (err) {
              console.error('Remove friend error:', err);
              Alert.alert('Error', 'An unexpected error occurred.');
            }
          }
        }
      ]
    );
  };

  const handleToggleNotif = async (type: 'vibePeak' | 'proximity' | 'social', value: boolean) => {
    if (type === 'vibePeak') {
      setNotifVibePeak(value);
      await SecureStore.setItemAsync('notif_vibe_peak', String(value));
    } else if (type === 'proximity') {
      setNotifProximity(value);
      await SecureStore.setItemAsync('notif_proximity', String(value));
    } else if (type === 'social') {
      setNotifSocial(value);
      await SecureStore.setItemAsync('notif_social', String(value));
    }

    try {
      const token = await SecureStore.getItemAsync('user_token');
      if (!token) return;

      await fetch(`${API_URL}/api/auth/notification-settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          vibePeak: type === 'vibePeak' ? value : undefined,
          proximity: type === 'proximity' ? value : undefined,
          social: type === 'social' ? value : undefined,
        })
      });
    } catch (err) {
      console.error('Failed to update notification settings on server:', err);
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
        <AccountItem
          icon="notifications-none"
          label="Notifications"
          styles={styles}
          onPress={() => setShowNotifModal(true)}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Social Circle</Text>
        <AccountItem
          icon="share"
          label="Invite Friends"
          styles={styles}
          onPress={handleShareInvite}
        />
        <AccountItem
          icon="qr-code"
          label="My QR Code"
          styles={styles}
          onPress={() => setShowQRCodeModal(true)}
        />
        <AccountItem
          icon="qr-code-scanner"
          label="Scan QR Code"
          styles={styles}
          onPress={handleScanQRCode}
        />
        <AccountItem
          icon="contacts"
          label="Find Friends from Contacts"
          styles={styles}
          onPress={handleSyncContacts}
        />
        <AccountItem
          icon="group"
          label="Friends List & Requests"
          styles={styles}
          onPress={handleOpenFriendsList}
        />
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
        <AccountItem
          icon="security"
          label="Privacy Policy"
          styles={styles}
          onPress={() => {
            Linking.openURL('https://revynd-api-939729691035.us-east1.run.app/privacy-policy.html')
              .catch(err => {
                console.error('Failed to open privacy policy URL:', err);
                Alert.alert('Error', 'Unable to open privacy policy webpage.');
              });
          }}
        />
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
              This will permanently delete your account and all associated data, including your check-in history. This action cannot be undone.
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
                onPress={() => {
                  setShowDeleteModal(false);
                  setShowSecondDeleteModal(true);
                }}
              >
                <Text style={styles.modalDeleteText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Account Deletion Secondary Confirmation Modal */}
      <Modal
        visible={showSecondDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSecondDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Are you absolutely sure?</Text>
            <Text style={styles.modalMessage}>
              Once deleted, your account and location history are permanently erased and cannot be recovered.
            </Text>
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setShowSecondDeleteModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalDeleteButton]}
                onPress={confirmDeleteAccount}
              >
                <Text style={styles.modalDeleteText}>Delete Permanently</Text>
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

      {/* My QR Code Modal */}
      <Modal
        visible={showQRCodeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQRCodeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { alignItems: 'center' }]}>
            <Text style={styles.modalTitle}>My QR Code</Text>
            <Text style={[styles.modalMessage, { textAlign: 'center', marginBottom: 20 }]}>
              Show this QR code to a friend to let them scan and add you instantly on REVYND!
            </Text>

            <View style={{
              padding: 24,
              backgroundColor: '#fff',
              borderRadius: 20,
              shadowColor: '#000',
              shadowOpacity: 0.1,
              shadowRadius: 10,
              elevation: 4,
              marginBottom: 24
            }}>
              {userId ? (
                <QRCode
                  value={`${API_URL}/invite.html?referrerId=${userId}`}
                  size={180}
                  color="#1E293B"
                  backgroundColor="#FFFFFF"
                />
              ) : (
                <ActivityIndicator size="large" color="#FB923C" />
              )}
            </View>

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, { backgroundColor: '#FB923C', marginRight: 0 }]}
                onPress={() => setShowQRCodeModal(false)}
              >
                <Text style={styles.modalDeleteText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* QR Code Scanner Modal */}
      <Modal
        visible={showScanner}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowScanner(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            onBarcodeScanned={scanning ? undefined : handleBarcodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
          />

          <View style={styles.scannerOverlay}>
            <View style={styles.scannerOutline}>
              {scanning && <ActivityIndicator size="large" color="#FB923C" />}
            </View>
            <Text style={styles.scannerText}>Align QR code inside the box</Text>

            <TouchableOpacity
              style={styles.scannerCloseButton}
              onPress={() => setShowScanner(false)}
            >
              <MaterialIcons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Contact Sync Modal */}
      <Modal
        visible={showContactsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowContactsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Find Friends</Text>
            <Text style={styles.modalMessage}>
              Search for users by email or phone number, or sync your phonebook contacts.
            </Text>

            {isSearching || isSyncingContacts ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#FB923C" />
                <Text style={{ marginTop: 12, color: theme.subtext, fontWeight: '500' }}>
                  {isSearching ? 'Searching...' : 'Matching contacts...'}
                </Text>
              </View>
            ) : (searchResults !== null ? searchResults : syncedContacts).length === 0 ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <MaterialIcons name="person-search" size={48} color={theme.border} />
                <Text style={{ marginTop: 12, color: theme.subtext, textAlign: 'center', fontWeight: '500' }}>
                  {searchResults !== null
                    ? 'No user found matching search query.'
                    : 'No new contacts found on the app.'}
                </Text>
              </View>
            ) : (
              <ScrollView style={{ marginBottom: 20 }}>
                {(searchResults !== null ? searchResults : syncedContacts).map((contact) => (
                  <View key={contact.id} style={styles.friendRow}>
                    <View style={styles.friendAvatar}>
                      {contact.profilePicture ? (
                        <Image source={{ uri: contact.profilePicture }} style={styles.friendAvatarImg} />
                      ) : (
                        <Text style={styles.friendAvatarText}>
                          {contact.name ? contact.name.charAt(0).toUpperCase() : 'U'}
                        </Text>
                      )}
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.friendName}>{contact.name}</Text>
                    </View>
                    {contact.relationship === 'ACCEPTED' ? (
                      <View style={[styles.statusBadge, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                        <Text style={[styles.statusBadgeText, { color: '#10B981' }]}>Friends</Text>
                      </View>
                    ) : contact.relationship === 'PENDING' ? (
                      <View style={[styles.statusBadge, { backgroundColor: 'rgba(251, 146, 60, 0.1)' }]}>
                        <Text style={[styles.statusBadgeText, { color: '#FB923C' }]}>Pending</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.addFriendBtn}
                        onPress={() => handleAddFriendFromSync(contact.id)}
                      >
                        <Text style={styles.addFriendBtnText}>Add</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </ScrollView>
            )}

            <View style={[styles.modalButtons, { marginTop: 10 }]}>
              <Pressable
                style={[styles.modalButton, { backgroundColor: '#FB923C', marginRight: 0 }]}
                onPress={() => setShowContactsModal(false)}
              >
                <Text style={styles.modalDeleteText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Friends List Modal */}
      <Modal
        visible={showFriendsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFriendsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Social Circle</Text>

            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tabButton, friendsActiveTab === 'friends' && styles.tabButtonActive]}
                onPress={() => setFriendsActiveTab('friends')}
              >
                <Text style={[styles.tabText, friendsActiveTab === 'friends' && styles.tabTextActive]}>
                  Friends ({friendsList.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, friendsActiveTab === 'pending' && styles.tabButtonActive]}
                onPress={() => setFriendsActiveTab('pending')}
              >
                <Text style={[styles.tabText, friendsActiveTab === 'pending' && styles.tabTextActive]}>
                  Requests ({pendingRequests.length})
                </Text>
              </TouchableOpacity>
            </View>

            {isLoadingFriends ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#FB923C" />
              </View>
            ) : friendsActiveTab === 'friends' ? (
              friendsList.length === 0 ? (
                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                  <MaterialIcons name="group-off" size={48} color={theme.border} />
                  <Text style={{ marginTop: 12, color: theme.subtext, fontWeight: '500' }}>No friends added yet.</Text>
                </View>
              ) : (
                <ScrollView style={{ marginBottom: 20 }}>
                  {friendsList.map((friend) => (
                    <View key={friend.id} style={styles.friendRow}>
                      <View style={styles.friendAvatar}>
                        {friend.profilePicture ? (
                          <Image source={{ uri: friend.profilePicture }} style={styles.friendAvatarImg} />
                        ) : (
                          <Text style={styles.friendAvatarText}>
                            {friend.name ? friend.name.charAt(0).toUpperCase() : 'U'}
                          </Text>
                        )}
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.friendName}>{friend.name}</Text>
                        <Text style={styles.friendSub}>{friend.email}</Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.addFriendBtn, { backgroundColor: '#EF4444' }]}
                        onPress={() => handleRemoveFriend(friend.id, friend.name)}
                      >
                        <Text style={styles.addFriendBtnText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )
            ) : (
              pendingRequests.length === 0 ? (
                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                  <MaterialIcons name="mail-outline" size={48} color={theme.border} />
                  <Text style={{ marginTop: 12, color: theme.subtext, fontWeight: '500' }}>No pending requests.</Text>
                </View>
              ) : (
                <ScrollView style={{ marginBottom: 20 }}>
                  {pendingRequests.map((req) => (
                    <View key={req.requestId} style={styles.friendRow}>
                      <View style={styles.friendAvatar}>
                        {req.profilePicture ? (
                          <Image source={{ uri: req.profilePicture }} style={styles.friendAvatarImg} />
                        ) : (
                          <Text style={styles.friendAvatarText}>
                            {req.name ? req.name.charAt(0).toUpperCase() : 'U'}
                          </Text>
                        )}
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.friendName}>{req.name}</Text>
                        <Text style={styles.friendSub}>{req.email}</Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.addFriendBtn, { backgroundColor: '#0D9488' }]}
                        onPress={() => handleAcceptFriendRequest(req.requestId)}
                      >
                        <Text style={styles.addFriendBtnText}>Accept</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )
            )}

            <View style={[styles.modalButtons, { marginTop: 10 }]}>
              <Pressable
                style={[styles.modalButton, { backgroundColor: '#FB923C', marginRight: 0 }]}
                onPress={() => setShowFriendsModal(false)}
              >
                <Text style={styles.modalDeleteText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Notification Preferences Modal */}
      <Modal
        visible={showNotifModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNotifModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Notification Preferences</Text>
            <Text style={styles.modalMessage}>
              Choose which notifications you would like to receive.
            </Text>

            <View style={styles.switchRow}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={styles.switchLabel}>Peak Vibe Alerts</Text>
                <Text style={styles.switchSublabel}>Get notified when spots near you hit peak vibes</Text>
              </View>
              <Switch
                value={notifVibePeak}
                onValueChange={(val) => handleToggleNotif('vibePeak', val)}
                trackColor={{ false: '#94A3B8', true: '#639cec' }}
                thumbColor={notifVibePeak ? '#FB923C' : '#F4F3F4'}
                ios_backgroundColor="#CBD5E1"
              />
            </View>

            <View style={styles.switchRow}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={styles.switchLabel}>Proximity Check-Ins</Text>
                <Text style={styles.switchSublabel}>Remind me to check in when I'm near a spot</Text>
              </View>
              <Switch
                value={notifProximity}
                onValueChange={(val) => handleToggleNotif('proximity', val)}
                trackColor={{ false: '#94A3B8', true: '#639cec' }}
                thumbColor={notifProximity ? '#FB923C' : '#F4F3F4'}
                ios_backgroundColor="#CBD5E1"
              />
            </View>

            <View style={styles.switchRow}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={styles.switchLabel}>Social Circle Alerts</Text>
                <Text style={styles.switchSublabel}>Notify me of new friend requests and activity</Text>
              </View>
              <Switch
                value={notifSocial}
                onValueChange={(val) => handleToggleNotif('social', val)}
                trackColor={{ false: '#94A3B8', true: '#639cec' }}
                thumbColor={notifSocial ? '#FB923C' : '#F4F3F4'}
                ios_backgroundColor="#CBD5E1"
              />
            </View>

            <View style={[styles.modalButtons, { marginTop: 10 }]}>
              <Pressable
                style={[styles.modalButton, { backgroundColor: '#FB923C', marginRight: 0 }]}
                onPress={() => setShowNotifModal(false)}
              >
                <Text style={styles.modalDeleteText}>Done</Text>
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
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scannerOutline: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: '#FB923C',
    backgroundColor: 'transparent',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerText: {
    color: '#FFF',
    marginTop: 20,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden'
  },
  scannerCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.primary || '#FB923C',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  friendAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  friendAvatarText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  friendSub: {
    fontSize: 12,
    color: theme.subtext,
    marginTop: 2,
  },
  addFriendBtn: {
    backgroundColor: '#FB923C',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addFriendBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: theme.background,
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: theme.card,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.subtext,
  },
  tabTextActive: {
    color: theme.text,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    marginBottom: 8,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  switchSublabel: {
    fontSize: 12,
    color: theme.subtext,
    marginTop: 4,
    lineHeight: 16,
  },
  searchBarContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'center',
    backgroundColor: theme.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: theme.text,
    fontSize: 15,
  },
  searchButton: {
    backgroundColor: '#FB923C',
    padding: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});