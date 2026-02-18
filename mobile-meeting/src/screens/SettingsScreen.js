import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { healthCheck } from '../services/api';
import {
  getBackendUrl,
  setBackendUrl,
  getSignalingUrl,
  setSignalingUrl,
  getUserData,
  clearToken,
  clearUserData,
} from '../utils/storage';

const SettingsScreen = ({ navigation }) => {
  const [userData, setUserData] = useState(null);
  const [backendUrl, setBackendUrlState] = useState('');
  const [signalingUrl, setSignalingUrlState] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      console.log('[SETTINGS] Loading settings...');
      const user = await getUserData();
      console.log('[SETTINGS] User data loaded:', user?.email);
      setUserData(user);

      const backend = await getBackendUrl();
      setBackendUrlState(backend);

      const signaling = await getSignalingUrl();
      setSignalingUrlState(signaling);
      
      console.log('[SETTINGS] Settings loaded successfully');
    } catch (error) {
      console.error('[SETTINGS] Error loading settings:', error);
      // Don't show alert - just log the error
    }
  };

  const handleSaveSettings = async () => {
    console.log('[SETTINGS] Save settings clicked');
    try {
      await setBackendUrl(backendUrl);
      await setSignalingUrl(signalingUrl);
      const msg = 'Settings saved successfully';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Success', msg);
      }
    } catch (error) {
      console.error('[SETTINGS] Save settings error:', error);
      const msg = 'Failed to save settings';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    }
  };

  const handleTestConnection = async () => {
    console.log('[SETTINGS] Test connection clicked');
    setTesting(true);
    try {
      const response = await healthCheck();
      if (response.status === 200) {
        const msg = 'Backend API connection successful!';
        if (Platform.OS === 'web') {
          window.alert(msg);
        } else {
          Alert.alert('Success', msg);
        }
      }
    } catch (error) {
      console.warn('[SETTINGS] Connection failed:', error.message);
      const msg = 'Unable to connect to backend API. Please check the URL.';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Connection Failed', msg);
      }
    } finally {
      setTesting(false);
    }
  };

  const handleLogout = async () => {
    console.log('[SETTINGS] Logout button clicked');
    
    const confirmLogout = () => {
      console.log('[SETTINGS] Logout confirmed, clearing data...');
      
      clearToken()
        .then(() => clearUserData())
        .then(() => {
          console.log('[SETTINGS] Token and user data cleared');
          // Navigation handled by App.js based on token polling
          if (Platform.OS === 'web') {
            window.alert('Logged out successfully');
          } else {
            Alert.alert('Success', 'Logged out successfully');
          }
        })
        .catch((error) => {
          console.error('[SETTINGS] Logout error:', error);
          const msg = 'Failed to logout';
          if (Platform.OS === 'web') {
            window.alert(msg);
          } else {
            Alert.alert('Error', msg);
          }
        });
    };

    if (Platform.OS === 'web') {
      // Use native browser confirm on web
      if (window.confirm('Are you sure you want to log out?')) {
        confirmLogout();
      }
    } else {
      // Use React Native Alert on mobile
      Alert.alert('Confirm Logout', 'Are you sure you want to log out?', [
        { text: 'Cancel', onPress: () => {} },
        {
          text: 'Logout',
          onPress: confirmLogout,
        },
      ]);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>User Profile</Text>
        <View style={styles.profileCard}>
          <Text style={styles.label}>Name:</Text>
          <Text style={styles.value}>{userData?.full_name || 'N/A'}</Text>

          <Text style={styles.label}>Email:</Text>
          <Text style={styles.value}>{userData?.email || 'N/A'}</Text>

          <Text style={styles.label}>Role:</Text>
          <Text style={styles.value}>{userData?.role?.toUpperCase() || 'MEMBER'}</Text>
        </View>
      </View>

      {(userData?.role === 'admin' || userData?.role === 'host') && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Backend API Configuration</Text>
          <Text style={styles.label}>Backend URL:</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter backend API URL"
            value={backendUrl}
            onChangeText={setBackendUrlState}
          />

          <Text style={styles.label}>Signaling Server URL:</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter signaling server URL"
            value={signalingUrl}
            onChangeText={setSignalingUrlState}
          />

          <View style={styles.tips}>
            <Text style={styles.tipsTitle}>Default URLs:</Text>
            <Text style={styles.tipsText}>
              Backend: https://meeting-backend-production-ba47.up.railway.app
            </Text>
            <Text style={styles.tipsText}>
              Signaling: https://meeting-signaling-server-production.up.railway.app
            </Text>
          </View>

          <TouchableOpacity
            style={styles.testButton}
            onPress={handleTestConnection}
            disabled={testing}
          >
            {testing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.testButtonText}>Test Connection</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.saveButton} onPress={handleSaveSettings}>
            <Text style={styles.saveButtonText}>Save Settings</Text>
          </TouchableOpacity>
        </View>
      )}

      {(userData?.role === 'admin' || userData?.role === 'host') && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Admin Panel</Text>
          <View style={styles.adminInfo}>
            <Text style={styles.adminBadge}>
              👤 {userData?.role?.toUpperCase()}
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.adminButton} 
            onPress={() => navigation.navigate('AdminSettings', { isGlobal: true })}
          >
            <Text style={styles.adminButtonText}>Global Admin Settings</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Meeting App v1.0.0</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    backgroundColor: '#fff',
    marginVertical: 10,
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  profileCard: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 15,
  },
  label: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 10,
    marginBottom: 5,
  },
  value: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 14,
    backgroundColor: '#f9f9f9',
  },
  tips: {
    backgroundColor: '#f0f7ff',
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
    padding: 12,
    borderRadius: 4,
    marginBottom: 15,
  },
  tipsTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 5,
  },
  tipsText: {
    fontSize: 12,
    color: '#333',
    marginBottom: 3,
  },
  testButton: {
    backgroundColor: '#FF9800',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  testButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  logoutButton: {
    backgroundColor: '#f44336',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  adminInfo: {
    marginBottom: 12,
  },
  adminBadge: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#007AFF',
    backgroundColor: '#e3f2fd',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  adminButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  adminButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
  },
});

export default SettingsScreen;
