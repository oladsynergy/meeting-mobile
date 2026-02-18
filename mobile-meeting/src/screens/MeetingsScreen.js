import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { meetingAPI } from '../services/api';
import { getUserData } from '../utils/storage';

const MeetingsScreen = ({ navigation }) => {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [meetingCode, setMeetingCode] = useState('');
  const [userData, setUserData] = useState(null);
  
  // Create meeting form fields
  const [newMeeting, setNewMeeting] = useState({
    title: '',
    scheduledTime: '',
    password: '',
  });

  const getDefaultDateTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  useFocusEffect(
    React.useCallback(() => {
      loadUserData();
      loadMeetings();
    }, [])
  );

  const loadUserData = async () => {
    try {
      const user = await getUserData();
      setUserData(user);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadMeetings = async () => {
    try {
      const response = await meetingAPI.getMeetings();
      setMeetings(response.data.meetings || []);
    } catch (error) {
      console.warn('Error loading meetings, using mock data:', error);
      // Show mock meetings when backend is unavailable
      setMeetings([
        {
          id: 1,
          title: 'Sample Meeting',
          meeting_code: 'ABC12345',
          start_time: new Date(Date.now() + 3600000).toISOString(),
          status: 'active',
          expected_attendees: 5
        }
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMeetings();
  };

  const handleJoinMeeting = async () => {
    if (!meetingCode) {
      Alert.alert('Error', 'Please enter a meeting code');
      return;
    }

    try {
      const response = await meetingAPI.getMeetingByCode(meetingCode);
      const meeting = response.data.meeting;
      setJoinModalVisible(false);
      setMeetingCode('');
      navigation.navigate('MeetingDetail', {
        meetingId: meeting.id,
        meeting,
      });
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Invalid meeting code');
    }
  };

  const handleCreateMeeting = async () => {
    if (!newMeeting.title) {
      Alert.alert('Error', 'Please enter a meeting title');
      return;
    }

    try {
      // Convert datetime-local format to ISO string if provided
      let scheduledTime = new Date().toISOString();
      if (newMeeting.scheduledTime) {
        scheduledTime = new Date(newMeeting.scheduledTime).toISOString();
      }

      const meetingData = {
        title: newMeeting.title,
        scheduled_time: scheduledTime,
        password: newMeeting.password || '',
      };

      const response = await meetingAPI.createMeeting(meetingData);
      
      Alert.alert(
        'Success', 
        `Meeting created!\nCode: ${response.data.meeting.meeting_code}`,
        [
          {
            text: 'OK',
            onPress: () => {
              setCreateModalVisible(false);
              setNewMeeting({ title: '', scheduledTime: '', password: '' });
              loadMeetings();
            }
          }
        ]
      );
    } catch (error) {
      console.warn('Create meeting failed, using mock:', error);
      // Mock success for testing
      const mockCode = 'MOCK' + Math.floor(Math.random() * 10000);
      const timeStr = newMeeting.scheduledTime 
        ? `\nScheduled: ${new Date(newMeeting.scheduledTime).toLocaleString()}`
        : '\nStarting: Now';
      
      Alert.alert(
        'Success (Mock)', 
        `Meeting "${newMeeting.title}" created!\nCode: ${mockCode}${timeStr}`,
        [
          {
            text: 'OK',
            onPress: () => {
              setCreateModalVisible(false);
              setNewMeeting({ title: '', scheduledTime: '', password: '' });
            }
          }
        ]
      );
    }
  };

  const canCreateMeeting = userData?.role === 'admin' || userData?.role === 'host';

  const filteredMeetings = meetings.filter(
    (m) =>
      m.title.toLowerCase().includes(searchText.toLowerCase()) ||
      m.meeting_code.includes(searchText)
  );

  const renderMeetingItem = ({ item }) => (
    <TouchableOpacity
      style={styles.meetingCard}
      onPress={() =>
        navigation.navigate('MeetingDetail', {
          meetingId: item.id,
          meeting: item,
        })
      }
    >
      <View style={styles.cardHeader}>
        <Text style={styles.meetingTitle}>{item.title}</Text>
        <Text
          style={[
            styles.statusBadge,
            {
              backgroundColor: item.status === 'active' ? '#4CAF50' : '#FF9800',
            },
          ]}
        >
          {item.status?.toUpperCase()}
        </Text>
      </View>
      <Text style={styles.cardText}>Code: {item.meeting_code}</Text>
      <Text style={styles.cardText}>
        Attendees: {item.expected_attendees || 0}
      </Text>
      <Text style={styles.cardDate}>
        {new Date(item.start_time).toLocaleString()}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search meetings..."
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>

      <View style={styles.buttonContainer}>
        {canCreateMeeting && (
          <TouchableOpacity
            style={[styles.actionButton, styles.createButton]}
            onPress={() => setCreateModalVisible(true)}
          >
            <Text style={styles.actionButtonText}>+ Create Meeting</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionButton, styles.joinButton]}
          onPress={() => setJoinModalVisible(true)}
        >
          <Text style={styles.actionButtonText}>Join by Code</Text>
        </TouchableOpacity>
      </View>

      {filteredMeetings.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No meetings found</Text>
        </View>
      ) : (
        <FlatList
          data={filteredMeetings}
          renderItem={renderMeetingItem}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Join Meeting Modal */}
      <Modal
        visible={joinModalVisible}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Join Meeting</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter meeting code"
              value={meetingCode}
              onChangeText={setMeetingCode}
              autoCapitalize="characters"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  setJoinModalVisible(false);
                  setMeetingCode('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={handleJoinMeeting}
              >
                <Text style={styles.primaryButtonText}>Join</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Meeting Modal */}
      <Modal
        visible={createModalVisible}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>Create New Meeting</Text>
              
              <Text style={styles.label}>Meeting Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter meeting title"
                value={newMeeting.title}
                onChangeText={(text) => setNewMeeting({...newMeeting, title: text})}
              />

              <Text style={styles.label}>Scheduled Time (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder={getDefaultDateTime()}
                value={newMeeting.scheduledTime}
                onChangeText={(text) => setNewMeeting({...newMeeting, scheduledTime: text})}
                // @ts-ignore - datetime-local works on web
                type="datetime-local"
              />

              <Text style={styles.label}>Password (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter meeting password"
                value={newMeeting.password}
                onChangeText={(text) => setNewMeeting({...newMeeting, password: text})}
                secureTextEntry
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => {
                    setCreateModalVisible(false);
                    setNewMeeting({ title: '', scheduledTime: '', password: '' });
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.primaryButton]}
                  onPress={handleCreateMeeting}
                >
                  <Text style={styles.primaryButtonText}>Create</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  buttonContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginVertical: 10,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  createButton: {
    backgroundColor: '#4CAF50',
  },
  joinButton: {
    backgroundColor: '#007AFF',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
    marginTop: 10,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  meetingCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  meetingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cardText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  cardDate: {
    fontSize: 12,
    color: '#999',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    fontSize: 14,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: 'bold',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default MeetingsScreen;
