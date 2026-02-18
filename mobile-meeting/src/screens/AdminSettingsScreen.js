import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import { meetingAPI } from '../services/api';
import { getUserData } from '../utils/storage';
import { useIsFocused } from '@react-navigation/native';

const AdminSettingsScreen = ({ route, navigation }) => {
  const isFocused = useIsFocused();
  const meetingId = route?.params?.meetingId;
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (isFocused) {
      loadSettings();
    }
  }, [isFocused]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const user = await getUserData();
      setUserData(user);

      // Check if user is admin or host
      if (user?.role !== 'admin' && user?.role !== 'host') {
        console.warn('[ADMIN SETTINGS] User is not admin/host, access denied. Role:', user?.role);
        const msg = 'Only admins and hosts can access these settings';
        if (Platform.OS === 'web') {
          window.alert(msg);
        } else {
          Alert.alert('Access Denied', msg);
        }
        setIsAuthorized(false);
        setLoading(false);
        return;
      }

      setIsAuthorized(true);

      // If no meetingId, just show empty state for global admin settings
      if (!meetingId) {
        console.log('[ADMIN SETTINGS] Global admin settings (no specific meeting)');
        setSettings({});
        setLoading(false);
        return;
      }

      try {
        const response = await meetingAPI.getMeetingSettings(meetingId);
        setSettings(response.data.settings || {});
      } catch (error) {
        console.warn('[ADMIN SETTINGS] Failed to load meeting settings, using empty:', error.message);
        setSettings({});
      }
    } catch (error) {
      console.error('[ADMIN SETTINGS] Error loading settings:', error);
      const msg = 'Failed to load settings';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSetting = async (key, value) => {
    const updatedSettings = { ...settings, [key]: value };
    setSettings(updatedSettings);
    await saveSettings(updatedSettings);
  };

  const saveSettings = async (updatedSettings) => {
    try {
      setSaving(true);
      await meetingAPI.updateMeetingSettings(meetingId, updatedSettings);
      Alert.alert('Success', 'Settings have been updated');
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings');
      loadSettings(); // Reload to revert
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!userData || (userData.role !== 'admin' && userData.role !== 'host')) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.errorText}>Unauthorized access</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Meeting Settings</Text>
        <Text style={styles.subtitle}>Admin controls</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Host Permissions</Text>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Host Can Lock</Text>
          <Switch
            value={settings?.host_can_lock ?? true}
            onValueChange={(value) => handleToggleSetting('host_can_lock', value)}
            disabled={saving}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Host Can Mute</Text>
          <Switch
            value={settings?.host_can_mute ?? true}
            onValueChange={(value) => handleToggleSetting('host_can_mute', value)}
            disabled={saving}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Host Can Control Video</Text>
          <Switch
            value={settings?.host_can_video ?? true}
            onValueChange={(value) => handleToggleSetting('host_can_video', value)}
            disabled={saving}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Host Can Chat</Text>
          <Switch
            value={settings?.host_can_chat ?? true}
            onValueChange={(value) => handleToggleSetting('host_can_chat', value)}
            disabled={saving}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Host Can Share Screen</Text>
          <Switch
            value={settings?.host_can_screen ?? true}
            onValueChange={(value) => handleToggleSetting('host_can_screen', value)}
            disabled={saving}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Host Can Remove Participants</Text>
          <Switch
            value={settings?.host_can_remove ?? true}
            onValueChange={(value) => handleToggleSetting('host_can_remove', value)}
            disabled={saving}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Host Can End Meeting</Text>
          <Switch
            value={settings?.host_can_end_meeting ?? true}
            onValueChange={(value) => handleToggleSetting('host_can_end_meeting', value)}
            disabled={saving}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Participant Features</Text>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Allow Raise Hand</Text>
          <Switch
            value={settings?.allow_raise_hand ?? true}
            onValueChange={(value) => handleToggleSetting('allow_raise_hand', value)}
            disabled={saving}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Allow Screen Share</Text>
          <Switch
            value={settings?.allow_screen_share ?? true}
            onValueChange={(value) => handleToggleSetting('allow_screen_share', value)}
            disabled={saving}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Allow Recording</Text>
          <Switch
            value={settings?.allow_recording ?? true}
            onValueChange={(value) => handleToggleSetting('allow_recording', value)}
            disabled={saving}
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Allow System Audio</Text>
          <Switch
            value={settings?.allow_system_audio ?? true}
            onValueChange={(value) => handleToggleSetting('allow_system_audio', value)}
            disabled={saving}
          />
        </View>
      </View>

      {saving && (
        <View style={styles.savingIndicator}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.savingText}>Saving...</Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#fff',
    marginVertical: 10,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLabel: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 20,
    borderRadius: 8,
  },
  savingText: {
    marginLeft: 10,
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 16,
    color: '#f44336',
  },
});

export default AdminSettingsScreen;
