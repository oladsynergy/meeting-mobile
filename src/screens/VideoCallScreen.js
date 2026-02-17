import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  SafeAreaView,
  ActivityIndicator,
  FlatList,
  Alert
} from 'react-native';
import { RTCView } from 'react-native-webrtc';
import { useRoute } from '@react-navigation/native';
import webRTCService from '../services/webrtc';
import { getSignalingSocket } from '../services/api';

export default function VideoCallScreen({ navigation }) {
  const route = useRoute();
  const { meetingId, meetingTitle, currentUserId, currentUserName } = route.params;
  
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [callConnecting, setCallConnecting] = useState(true);
  const [participants, setParticipants] = useState([]);
  const socketRef = useRef(null);

  // Initialize call
  useEffect(() => {
    const initCall = async () => {
      try {
        // Initialize local stream
        const stream = await webRTCService.initLocalStream();
        setLocalStream(stream);

        // Connect to signaling server
        const socket = getSignalingSocket();
        socketRef.current = socket;

        // Join call
        socket.emit('join-call', {
          meetingId,
          userId: currentUserId,
          userName: currentUserName
        });

        // Handle other users joining
        socket.on('user-joined', async (data) => {
          const { userId, userName } = data;
          setParticipants(prev => [...prev, { userId, userName, connected: false }]);

          // Create offer for new user
          const pc = webRTCService.createPeerConnection(userId);
          
          // Setup event handlers
          webRTCService.onIceCandidate(userId, (candidate) => {
            socket.emit('ice-candidate', {
              to: userId,
              candidate: candidate.toJSON(),
              from: currentUserId
            });
          });

          webRTCService.onRemoteTrack(userId, (stream) => {
            setRemoteStreams(prev => ({ ...prev, [userId]: stream }));
          });

          webRTCService.onConnectionStateChange(userId, (state) => {
            if (state === 'connected') {
              setParticipants(prev =>
                prev.map(p => p.userId === userId ? { ...p, connected: true } : p)
              );
            }
          });

          // Send offer
          const offer = await webRTCService.createOffer(userId);
          socket.emit('offer', {
            to: userId,
            offer: offer.toJSON(),
            from: currentUserId,
            fromName: currentUserName
          });
        });

        // Handle receiving offer
        socket.on('offer', async (data) => {
          const { from, fromName, offer } = data;
          
          // Add to participants if not already there
          setParticipants(prev => 
            !prev.find(p => p.userId === from)
              ? [...prev, { userId: from, userName: fromName, connected: false }]
              : prev
          );

          // Setup peer connection
          const pc = webRTCService.createPeerConnection(from);

          webRTCService.onIceCandidate(from, (candidate) => {
            socket.emit('ice-candidate', {
              to: from,
              candidate: candidate.toJSON(),
              from: currentUserId
            });
          });

          webRTCService.onRemoteTrack(from, (stream) => {
            setRemoteStreams(prev => ({ ...prev, [from]: stream }));
          });

          webRTCService.onConnectionStateChange(from, (state) => {
            if (state === 'connected') {
              setParticipants(prev =>
                prev.map(p => p.userId === from ? { ...p, connected: true } : p)
              );
            }
          });

          // Send answer
          const answer = await webRTCService.handleOffer(from, offer);
          socket.emit('answer', {
            to: from,
            answer: answer.toJSON(),
            from: currentUserId
          });
        });

        // Handle receiving answer
        socket.on('answer', async (data) => {
          const { from, answer } = data;
          await webRTCService.handleAnswer(from, answer);
          
          setParticipants(prev =>
            prev.map(p => p.userId === from ? { ...p, connected: true } : p)
          );
        });

        // Handle ICE candidates
        socket.on('ice-candidate', async (data) => {
          const { from, candidate } = data;
          await webRTCService.addIceCandidate(from, candidate);
        });

        // Handle user leaving
        socket.on('user-left', (data) => {
          const { userId } = data;
          webRTCService.closePeerConnection(userId);
          setRemoteStreams(prev => {
            const updated = { ...prev };
            delete updated[userId];
            return updated;
          });
          setParticipants(prev => prev.filter(p => p.userId !== userId));
        });

        setCallConnecting(false);
      } catch (error) {
        console.error('Error initializing call:', error);
        Alert.alert('Call Error', 'Failed to initialize video call');
        navigation.goBack();
      }
    };

    initCall();

    return () => {
      // Cleanup on unmount
      if (socketRef.current) {
        socketRef.current.emit('leave-call', {
          meetingId,
          userId: currentUserId
        });
      }
      webRTCService.cleanup();
    };
  }, []);

  // Toggle audio
  const handleToggleAudio = () => {
    webRTCService.toggleAudio(!audioEnabled);
    setAudioEnabled(!audioEnabled);
  };

  // Toggle video
  const handleToggleVideo = () => {
    webRTCService.toggleVideo(!videoEnabled);
    setVideoEnabled(!videoEnabled);
  };

  // End call
  const handleEndCall = () => {
    Alert.alert('End Call', 'Are you sure you want to end the call?', [
      { text: 'Cancel', onPress: () => {} },
      {
        text: 'End',
        onPress: () => {
          webRTCService.cleanup();
          if (socketRef.current) {
            socketRef.current.emit('leave-call', {
              meetingId,
              userId: currentUserId
            });
          }
          navigation.goBack();
        }
      }
    ]);
  };

  // Render local video
  const renderLocalVideo = () => {
    return (
      <View style={styles.localVideoContainer}>
        {localStream ? (
          <RTCView
            streamURL={localStream.toURL()}
            style={styles.localVideo}
            objectFit="cover"
            mirror={true}
          />
        ) : (
          <View style={styles.noCameraPlaceholder}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.placeholderText}>Camera loading...</Text>
          </View>
        )}
        <Text style={styles.localLabel}>You</Text>
      </View>
    );
  };

  // Render remote video
  const renderRemoteVideo = ({ item: userId }) => {
    const stream = remoteStreams[userId];
    const participant = participants.find(p => p.userId === userId);
    
    return (
      <View style={styles.remoteVideoContainer}>
        {stream ? (
          <RTCView
            streamURL={stream.toURL()}
            style={styles.remoteVideo}
            objectFit="cover"
          />
        ) : (
          <View style={styles.noCameraPlaceholder}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.placeholderText}>Connecting...</Text>
          </View>
        )}
        <View style={styles.participantInfo}>
          <Text style={styles.participantName}>
            {participant?.userName || 'User'}
          </Text>
          <View style={[
            styles.connectionStatus,
            { backgroundColor: participant?.connected ? '#4CAF50' : '#FF9800' }
          ]} />
        </View>
      </View>
    );
  };

  if (callConnecting) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Connecting to {meetingTitle}...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const remoteUserIds = Object.keys(remoteStreams);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{meetingTitle}</Text>
        <Text style={styles.subtitle}>
          {participants.length + 1} participant{participants.length !== 0 ? 's' : ''}
        </Text>
      </View>

      <View style={styles.videoArea}>
        {remoteUserIds.length > 0 ? (
          <FlatList
            data={remoteUserIds}
            renderItem={renderRemoteVideo}
            keyExtractor={item => item}
            numColumns={remoteUserIds.length === 1 ? 1 : 2}
            contentContainerStyle={styles.remoteVideosContainer}
          />
        ) : (
          <View style={styles.waitingContainer}>
            <Text style={styles.waitingText}>Waiting for others to join...</Text>
            <Text style={styles.waitingSubtext}>
              Meeting link can be shared with other participants
            </Text>
          </View>
        )}

        {renderLocalVideo()}
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.button, !audioEnabled && styles.buttonDisabled]}
          onPress={handleToggleAudio}
        >
          <Text style={styles.buttonIcon}>
            {audioEnabled ? '🎤' : '🔇'}
          </Text>
          <Text style={styles.buttonLabel}>
            {audioEnabled ? 'Mic On' : 'Mic Off'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, !videoEnabled && styles.buttonDisabled]}
          onPress={handleToggleVideo}
        >
          <Text style={styles.buttonIcon}>
            {videoEnabled ? '📹' : '📹'}
          </Text>
          <Text style={styles.buttonLabel}>
            {videoEnabled ? 'Camera On' : 'Camera Off'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.endCallButton]}
          onPress={handleEndCall}
        >
          <Text style={styles.buttonIcon}>📞</Text>
          <Text style={styles.buttonLabel}>End Call</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000'
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333'
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff'
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4
  },
  videoArea: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-end'
  },
  remoteVideosContainer: {
    flex: 1,
    padding: 8
  },
  remoteVideoContainer: {
    flex: 1,
    margin: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    overflow: 'hidden'
  },
  remoteVideo: {
    width: '100%',
    height: '100%'
  },
  participantInfo: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4
  },
  participantName: {
    flex: 1,
    color: '#fff',
    fontSize: 12,
    fontWeight: '500'
  },
  connectionStatus: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8
  },
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  waitingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center'
  },
  waitingSubtext: {
    color: '#888',
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 16
  },
  localVideoContainer: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    width: 120,
    height: 160,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#333'
  },
  localVideo: {
    width: '100%',
    height: '100%'
  },
  localLabel: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3
  },
  noCameraPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111'
  },
  placeholderText: {
    color: '#888',
    fontSize: 12,
    marginTop: 8
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: '#1a1a1a'
  },
  button: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#333'
  },
  buttonDisabled: {
    backgroundColor: '#555'
  },
  endCallButton: {
    backgroundColor: '#FF4444'
  },
  buttonIcon: {
    fontSize: 20,
    marginBottom: 4
  },
  buttonLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center'
  }
});
