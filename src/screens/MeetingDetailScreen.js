import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { meetingAPI, attendanceAPI } from '../services/api';
import { getUserData } from '../utils/storage';

const MeetingDetailScreen = ({ route, navigation }) => {
  const { meetingId, meeting: initialMeeting } = route.params;
  const [meeting, setMeeting] = useState(initialMeeting);
  const [loading, setLoading] = useState(!initialMeeting);
  const [userData, setUserData] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [hasJoined, setHasJoined] = useState(false);

  useEffect(() => {
    loadMeetingData();
  }, []);

  const loadMeetingData = async () => {
    try {
      const user = await getUserData();
      setUserData(user);

      if (!meeting) {
        const response = await meetingAPI.getMeetings();
        const found = response.data.meetings?.find((m) => m.id === meetingId);
        if (found) {
          setMeeting(found);
        }
      }

      // Load attendees
      const attendeeResponse = await attendanceAPI.getAttendanceByMeeting(meetingId);
      setAttendees(attendeeResponse.data.attendance || []);

      // Check if user has joined
      const joined = attendeeResponse.data.attendance?.some((a) => a.user_id === user?.id);
      setHasJoined(joined);
    } catch (error) {
      console.error('Error loading meeting data:', error);
      Alert.alert('Error', 'Failed to load meeting details');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinMeeting = async () => {
    try {
      await attendanceAPI.joinMeeting(meetingId, {
        user_id: userData.id,
        full_name: userData.full_name,
        email: userData.email,
      });
      Alert.alert('Success', 'You have joined the meeting');
      setHasJoined(true);
      loadMeetingData();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to join meeting');
    }
  };

  const handleLeaveMeeting = async () => {
    try {
      await attendanceAPI.leaveMeeting(meetingId);
      Alert.alert('Success', 'You have left the meeting');
      setHasJoined(false);
      loadMeetingData();
    } catch (error) {
      Alert.alert('Error', 'Failed to leave meeting');
    }
  };

  const handleStartVideoCall = () => {
    if (!userData) {
      Alert.alert('Error', 'User data not available');
      return;
    }
    navigation.navigate('VideoCall', {
      meetingId,
      meetingTitle: meeting.title,
      currentUserId: userData.id,
      currentUserName: userData.full_name,
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!meeting) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.errorText}>Meeting not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{meeting.title}</Text>
        <Text
          style={[
            styles.status,
            {
              backgroundColor: meeting.status === 'active' ? '#4CAF50' : '#FF9800',
            },
          ]}
        >
          {meeting.status?.toUpperCase()}
        </Text>
      </View>

      <View style={styles.details}>
        <Text style={styles.label}>Meeting Code:</Text>
        <Text style={styles.value}>{meeting.meeting_code}</Text>

        <Text style={styles.label}>Description:</Text>
        <Text style={styles.value}>{meeting.description || 'N/A'}</Text>

        <Text style={styles.label}>Start Time:</Text>
        <Text style={styles.value}>
          {new Date(meeting.start_time).toLocaleString()}
        </Text>

        {meeting.end_time && (
          <>
            <Text style={styles.label}>End Time:</Text>
            <Text style={styles.value}>
              {new Date(meeting.end_time).toLocaleString()}
            </Text>
          </>
        )}

        <Text style={styles.label}>Expected Attendees:</Text>
        <Text style={styles.value}>{meeting.expected_attendees || 0}</Text>

        <Text style={styles.label}>Current Attendees:</Text>
        <Text style={styles.value}>{attendees.length}</Text>
      </View>

      {hasJoined && (
        <>
          <Text style={styles.sectionTitle}>Meeting Attendees</Text>
          <View style={styles.attendeesList}>
            {attendees.map((attendee) => (
              <View key={attendee.id} style={styles.attendeeItem}>
                <Text style={styles.attendeeName}>{attendee.full_name}</Text>
                <Text style={styles.attendeeTime}>
                  Joined: {new Date(attendee.join_time).toLocaleTimeString()}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      <View style={styles.buttonContainer}>
        {hasJoined ? (
          <>
            <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveMeeting}>
              <Text style={styles.leaveButtonText}>Leave Meeting</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.callButton}
              onPress={handleStartVideoCall}
            >
              <Text style={styles.callButtonText}>Start Video Call</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.joinButton} onPress={handleJoinMeeting}>
            <Text style={styles.joinButtonText}>Join Meeting</Text>
          </TouchableOpacity>
        )}
      </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  status: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  details: {
    backgroundColor: '#fff',
    padding: 20,
    marginVertical: 10,
    marginHorizontal: 10,
    borderRadius: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 15,
    marginBottom: 5,
  },
  value: {
    fontSize: 14,
    color: '#333',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  attendeesList: {
    marginHorizontal: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
  },
  attendeeItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  attendeeName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  attendeeTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 3,
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 10,
  },
  joinButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  leaveButton: {
    backgroundColor: '#f44336',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  leaveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  callButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  callButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
  },
});

export default MeetingDetailScreen;
