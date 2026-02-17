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
      const user = await getUserData();
      setUserData(user);

      const backend = await getBackendUrl();
      setBackendUrlState(backend);

      const signaling = await getSignalingUrl();
      setSignalingUrlState(signaling);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await setBackendUrl(backendUrl);
      await setSignalingUrl(signalingUrl);
      Alert.alert('Success', 'Settings saved successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const response = await healthCheck();
      if (response.status === 200) {
        Alert.alert('Success', 'Backend API connection successful!');
      }
    } catch (error) {
      Alert.alert(
        'Connection Failed',
        'Unable to connect to backend API. Please check the URL.'
      );
    } finally {
      setTesting(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Confirm Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', onPress: () => {} },
      {
        text: 'Logout',
        onPress: async () => {
          try {
            await clearToken();
            await clearUserData();
            // Navigation handled by App.js based on token state
          } catch (error) {
            Alert.alert('Error', 'Failed to logout');
          }
        },
      },
    ]);
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
