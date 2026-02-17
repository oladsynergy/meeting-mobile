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
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { meetingAPI } from '../services/api';

const MeetingsScreen = ({ navigation }) => {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [meetingCode, setMeetingCode] = useState('');

  useFocusEffect(
    React.useCallback(() => {
      loadMeetings();
    }, [])
  );

  const loadMeetings = async () => {
    try {
      const response = await meetingAPI.getMeetings();
      setMeetings(response.data.meetings || []);
    } catch (error) {
      console.error('Error loading meetings:', error);
      Alert.alert('Error', 'Failed to load meetings');
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

      <TouchableOpacity
        style={styles.joinButton}
        onPress={() => setJoinModalVisible(true)}
      >
        <Text style={styles.joinButtonText}>Join Meeting by Code</Text>
      </TouchableOpacity>

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
  joinButton: {
    marginHorizontal: 20,
    marginVertical: 10,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    alignItems: 'center',
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
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
