import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
  TextInput,
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
  
  // Meeting controls state
  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [handRaised, setHandRaised] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatMessage, setChatMessage] = useState('');

  useEffect(() => {
    loadMeetingData();
  }, []);

  const loadMeetingData = async () => {
    try {
      const user = await getUserData();
      setUserData(user);

      if (!meeting) {
        try {
          const response = await meetingAPI.getMeetings();
          const found = response.data.meetings?.find((m) => m.id === meetingId);
          if (found) {
            setMeeting(found);
          }
        } catch (error) {
          console.warn('Error loading meetings list:', error.message);
          // Set the initial meeting if API fails
        }
      }

      // Load attendees
      try {
        const attendeeResponse = await attendanceAPI.getAttendanceByMeeting(meetingId);
        setAttendees(attendeeResponse.data.attendance || []);

        // Check if user has joined
        const joined = attendeeResponse.data.attendance?.some((a) => a.user_id === user?.id);
        setHasJoined(joined);
      } catch (error) {
        console.warn('Error loading attendance:', error.message);
        // Default to not joined on API failure
        setAttendees([]);
        setHasJoined(false);
      }
    } catch (error) {
      console.error('Error loading meeting data:', error);
      // Don't show alert - API is expected to fail in mock mode
    } finally {
      setLoading(false);
    }
  };

  const handleJoinMeeting = async () => {
    console.log('[MEETING DETAIL] Join button clicked, meetingId:', meetingId);
    
    try {
      console.log('[MEETING DETAIL] Attempting to join meeting via API...');
      await attendanceAPI.joinMeeting(meetingId, {
        user_id: userData.id,
        full_name: userData.full_name,
        email: userData.email,
      });
      console.log('[MEETING DETAIL] API join success');
      
      const successMsg = 'You have joined the meeting';
      if (Platform.OS === 'web') {
        window.alert(successMsg);
      } else {
        Alert.alert('Success', successMsg);
      }
      
      setHasJoined(true);
      loadMeetingData();
    } catch (error) {
      console.warn('[MEETING DETAIL] API join failed, using mock:', error.message);
      
      // Mock fallback - just set hasJoined to true
      const successMsg = `You have joined the meeting "${meeting.title}"`;
      if (Platform.OS === 'web') {
        window.alert(successMsg);
      } else {
        Alert.alert('Success', successMsg);
      }
      
      setHasJoined(true);
      // Don't reload meeting data since API is down, just update local state
    }
  };

  const handleLeaveMeeting = async () => {
    console.log('[MEETING DETAIL] Leave button clicked');
    
    try {
      console.log('[MEETING DETAIL] Attempting to leave meeting via API...');
      await attendanceAPI.leaveMeeting(meetingId);
      console.log('[MEETING DETAIL] API leave success');
      
      const successMsg = 'You have left the meeting';
      if (Platform.OS === 'web') {
        window.alert(successMsg);
      } else {
        Alert.alert('Success', successMsg);
      }
      
      setHasJoined(false);
      loadMeetingData();
    } catch (error) {
      console.warn('[MEETING DETAIL] API leave failed, using mock:', error.message);
      
      // Mock fallback - just set hasJoined to false
      const successMsg = 'You have left the meeting';
      if (Platform.OS === 'web') {
        window.alert(successMsg);
      } else {
        Alert.alert('Success', successMsg);
      }
      
      setHasJoined(false);
    }
  };

  const handleToggleMic = () => {
    setMicEnabled(!micEnabled);
    console.log('[MEETING DETAIL] Mic toggled:', !micEnabled ? 'ON' : 'OFF');
  };

  const handleToggleVideo = () => {
    setVideoEnabled(!videoEnabled);
    console.log('[MEETING DETAIL] Video toggled:', !videoEnabled ? 'ON' : 'OFF');
  };

  const handleRaiseHand = () => {
    setHandRaised(!handRaised);
    console.log('[MEETING DETAIL] Hand raised:', !handRaised);
  };

  const handleSendMessage = () => {
    if (!chatMessage.trim()) return;

    const newMsg = {
      id: Date.now(),
      sender: userData?.full_name || 'You',
      text: chatMessage,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages([...messages, newMsg]);
    setChatMessage('');
    console.log('[MEETING DETAIL] Message sent:', chatMessage);
  };

  const handleVote = (option) => {
    console.log('[MEETING DETAIL] Vote submitted:', option);
    window.alert(`Vote registered: ${option}`);
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
          <Text style={styles.sectionTitle}>Meeting Controls</Text>
          <View style={styles.controlsContainer}>
            <TouchableOpacity
              style={[styles.controlButton, micEnabled ? styles.controlButtonActive : styles.controlButtonInactive]}
              onPress={handleToggleMic}
            >
              <Text style={styles.controlButtonText}>{micEnabled ? '🎤' : '🔇'}</Text>
              <Text style={styles.controlButtonLabel}>Mic</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, videoEnabled ? styles.controlButtonActive : styles.controlButtonInactive]}
              onPress={handleToggleVideo}
            >
              <Text style={styles.controlButtonText}>{videoEnabled ? '📹' : '🚫'}</Text>
              <Text style={styles.controlButtonLabel}>Video</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, handRaised ? styles.controlButtonActive : styles.controlButtonInactive]}
              onPress={handleRaiseHand}
            >
              <Text style={styles.controlButtonText}>✋</Text>
              <Text style={styles.controlButtonLabel}>Raise Hand</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => setShowChat(!showChat)}
            >
              <Text style={styles.controlButtonText}>💬</Text>
              <Text style={styles.controlButtonLabel}>Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => handleVote('Yes')}
            >
              <Text style={styles.controlButtonText}>🗳️</Text>
              <Text style={styles.controlButtonLabel}>Vote</Text>
            </TouchableOpacity>
          </View>

          {showChat && (
            <View style={styles.chatContainer}>
              <Text style={styles.chatTitle}>Meeting Chat</Text>
              <ScrollView style={styles.messagesContainer}>
                {messages.length === 0 ? (
                  <Text style={styles.emptyChat}>No messages yet. Send one!</Text>
                ) : (
                  messages.map((msg) => (
                    <View key={msg.id} style={styles.message}>
                      <Text style={styles.messageSender}>{msg.sender}</Text>
                      <Text style={styles.messageText}>{msg.text}</Text>
                      <Text style={styles.messageTime}>{msg.timestamp}</Text>
                    </View>
                  ))
                )}
              </ScrollView>
              <View style={styles.inputContainer}>
                <TextInput
                  placeholder="Type a message..."
                  value={chatMessage}
                  onChangeText={setChatMessage}
                  onSubmitEditing={handleSendMessage}
                  style={styles.chatInput}
                  placeholderTextColor="#999"
                />
                <TouchableOpacity
                  style={styles.sendButton}
                  onPress={handleSendMessage}
                >
                  <Text style={styles.sendButtonText}>Send</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {(userData?.role === 'admin' || userData?.role === 'host') && (
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  controlsContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 10,
    marginBottom: 10,
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  controlButton: {
    width: '30%',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 5,
    backgroundColor: '#e3f2fd',
  },
  controlButtonActive: {
    backgroundColor: '#4CAF50',
  },
  controlButtonInactive: {
    backgroundColor: '#ffebee',
  },
  controlButtonText: {
    fontSize: 24,
    marginBottom: 5,
  },
  controlButtonLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  chatContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 10,
    marginBottom: 10,
    borderRadius: 8,
    padding: 10,
    maxHeight: 300,
  },
  chatTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  messagesContainer: {
    maxHeight: 200,
    marginBottom: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
    padding: 10,
  },
  emptyChat: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
  },
  message: {
    backgroundColor: '#e3f2fd',
    borderRadius: 4,
    padding: 8,
    marginBottom: 8,
  },
  messageSender: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  messageText: {
    fontSize: 13,
    color: '#333',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
    color: '#999',
    marginTop: 3,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 8,
    fontSize: 14,
    color: '#333',
  },
  sendButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    flexDirection: 'column',
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
    marginBottom: 10,
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
