import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme, AppTheme } from '../../theme/ThemeContext';

type AccountItemProps = {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
};

const AccountItem = ({ icon, label, onPress, rightElement }: AccountItemProps) => {
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  return (
    <TouchableOpacity style={styles.item} onPress={onPress} disabled={!onPress}>
      <View style={styles.itemLeft}>
        <View style={styles.iconWrapper}>
          <MaterialIcons name={icon} size={22} color={theme.subtext} />
        </View>
        <Text style={styles.itemLabel}>{label}</Text>
      </View>
      {rightElement ?? <MaterialIcons name="chevron-right" size={24} color={theme.border} />}
    </TouchableOpacity>
  );
};

const AccountScreen = () => {
  const { theme, isDark, toggleTheme } = useTheme();
  const styles = makeStyles(theme);

  // We'll eventually pull this from a Global State or Auth Context
  const user = {
    name: "Jem Turk",
    email: "JemTurk@gmail.com",
    memberSince: "2024",
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.name.charAt(0)}</Text>
        </View>
        <Text style={styles.userName}>{user.name}</Text>
        <Text style={styles.userEmail}>{user.email}</Text>
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
              // 'true' is the color when the switch is ON
              // 'false' is the color when the switch is OFF
              trackColor={{
                false: '#94A3B8', // A muted slate-grey for the "off" track
                true: '#639cec'   // Your Revynd Orange for the "on" track
              }}
              // thumbColor is the moving circle. 
              // We'll make it white when active to pop against the orange.
              thumbColor={isDark ? '#FB923C' : '#F4F3F4'}
              // Android specific: ensures the circle stays white even while being pressed
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
        <AccountItem icon="exit-to-app" label="Sign Out" onPress={() => { }} />
      </View>

      <Text style={styles.versionText}>Version 1.0.4</Text>
    </ScrollView>
  );
};

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
    backgroundColor: theme.primary,
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
  versionText: {
    textAlign: 'center',
    color: theme.subtext,
    fontSize: 12,
    marginTop: 40,
    marginBottom: 20,
  },
});

export default AccountScreen;