import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const AccountScreen = () => {
  // We'll eventually pull this from a Global State or Auth Context
  const user = {
    name: "Kemal Cem Unturk",
    email: "kemal@example.com", // Replace with your actual email
    memberSince: "2024"
  };

  const [isDarkMode, setIsDarkMode] = React.useState(false);

  const AccountItem = ({ icon, label, onPress, rightElement }: any) => (
    <TouchableOpacity style={styles.item} onPress={onPress} disabled={!onPress}>
      <View style={styles.itemLeft}>
        <View style={styles.iconWrapper}>
          <MaterialIcons name={icon} size={22} color="#64748B" />
        </View>
        <Text style={styles.itemLabel}>{label}</Text>
      </View>
      {rightElement ? rightElement : <MaterialIcons name="chevron-right" size={24} color="#CBD5E1" />}
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.name.charAt(0)}</Text>
        </View>
        <Text style={styles.userName}>{user.name}</Text>
        <Text style={styles.userEmail}>{user.email}</Text>
      </View>

      {/* App Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Settings</Text>
        <AccountItem 
          icon="brightness-6" 
          label="Dark Mode" 
          rightElement={
            <Switch 
              value={isDarkMode} 
              onValueChange={setIsDarkMode}
              trackColor={{ false: '#CBD5E1', true: '#3ca5fb' }}
            />
          } 
        />
        <AccountItem icon="notifications-none" label="Notifications" onPress={() => {}} />
      </View>

      {/* Account Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <AccountItem icon="person-outline" label="Edit Profile" onPress={() => {}} />
        <AccountItem icon="security" label="Privacy Policy" onPress={() => {}} />
        <AccountItem icon="exit-to-app" label="Sign Out" onPress={() => {}} />
      </View>
      
      <Text style={styles.versionText}>Version 1.0.4</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3ca5fb',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: { color: 'white', fontSize: 32, fontWeight: '800' },
  userName: { fontSize: 20, fontWeight: '700', color: '#1E293B' },
  userEmail: { fontSize: 14, color: '#64748B', marginTop: 4 },
  section: { marginTop: 24, paddingHorizontal: 16 },
  sectionTitle: { 
    fontSize: 13, 
    fontWeight: '700', 
    color: '#94A3B8', 
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  itemLeft: { flexDirection: 'row', alignItems: 'center' },
  iconWrapper: { marginRight: 12 },
  itemLabel: { fontSize: 16, color: '#334155', fontWeight: '500' },
  versionText: {
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 40,
    marginBottom: 20,
  }
});

export default AccountScreen;