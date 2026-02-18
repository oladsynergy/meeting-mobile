import { Platform } from 'react-native';

// Only import RTCPeerConnection on native platforms
let RTCPeerConnection, RTCIceCandidate, mediaDevices, RTCSessionDescription;

if (Platform.OS !== 'web') {
  const webrtc = require('react-native-webrtc');
  RTCPeerConnection = webrtc.RTCPeerConnection;
  RTCIceCandidate = webrtc.RTCIceCandidate;
  mediaDevices = webrtc.mediaDevices;
  RTCSessionDescription = webrtc.RTCSessionDescription;
}

class WebRTCService {
  constructor() {
    this.peerConnections = {};
    this.localStream = null;
    this.configuration = {
      iceServers: [
        { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
      ]
    };
  }

  // Initialize local stream with camera and audio
  async initLocalStream() {
    try {
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: {
          frameRate: 30,
          width: 640,
          height: 480
        }
      });
      this.localStream = stream;
      return stream;
    } catch (error) {
      console.error('Error getting user media:', error);
      throw error;
    }
  }

  // Create peer connection for a specific user
  createPeerConnection(userId) {
    try {
      if (this.peerConnections[userId]) {
        return this.peerConnections[userId];
      }

      const pc = new RTCPeerConnection(this.configuration);

      // Add local tracks
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          pc.addTrack(track, this.localStream);
        });
      }

      // Store peer connection
      this.peerConnections[userId] = { pc, iceCandidates: [] };

      return pc;
    } catch (error) {
      console.error('Error creating peer connection:', error);
      throw error;
    }
  }

  // Create and send offer to peer
  async createOffer(userId) {
    try {
      const pc = this.createPeerConnection(userId);
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await pc.setLocalDescription(offer);
      return offer;
    } catch (error) {
      console.error('Error creating offer:', error);
      throw error;
    }
  }

  // Receive and process answer from peer
  async handleAnswer(userId, answer) {
    try {
      const pc = this.peerConnections[userId]?.pc;
      if (!pc) {
        console.error('Peer connection not found for user:', userId);
        return;
      }
      const answerDescription = new RTCSessionDescription(answer);
      await pc.setRemoteDescription(answerDescription);
    } catch (error) {
      console.error('Error handling answer:', error);
      throw error;
    }
  }

  // Receive and process offer from peer
  async handleOffer(userId, offer) {
    try {
      const pc = this.createPeerConnection(userId);
      const offerDescription = new RTCSessionDescription(offer);
      await pc.setRemoteDescription(offerDescription);
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      return answer;
    } catch (error) {
      console.error('Error handling offer:', error);
      throw error;
    }
  }

  // Add ICE candidate
  async addIceCandidate(userId, candidate) {
    try {
      const pc = this.peerConnections[userId]?.pc;
      if (!pc) {
        console.error('Peer connection not found for user:', userId);
        // Store candidate for later if connection not yet created
        if (!this.peerConnections[userId]) {
          this.peerConnections[userId] = { iceCandidates: [] };
        }
        this.peerConnections[userId].iceCandidates.push(candidate);
        return;
      }
      const iceCandidate = new RTCIceCandidate(candidate);
      await pc.addIceCandidate(iceCandidate);
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }

  // Get remote stream for a user
  getRemoteStream(userId) {
    const pc = this.peerConnections[userId]?.pc;
    if (!pc) return null;
    
    const remoteStream = new (require('react-native-webrtc').MediaStream)();
    pc.getReceivers().forEach(receiver => {
      if (receiver.track) {
        remoteStream.addTrack(receiver.track);
      }
    });
    return remoteStream;
  }

  // Close connection with a user
  closePeerConnection(userId) {
    const pcObj = this.peerConnections[userId];
    if (pcObj && pcObj.pc) {
      pcObj.pc.close();
    }
    delete this.peerConnections[userId];
  }

  // Close all connections and stop local stream
  async cleanup() {
    // Close all peer connections
    Object.keys(this.peerConnections).forEach(userId => {
      this.closePeerConnection(userId);
    });

    // Stop local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
      });
      this.localStream = null;
    }
  }

  // Get local stream
  getLocalStream() {
    return this.localStream;
  }

  // Enable/disable audio
  toggleAudio(enabled) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  // Enable/disable video
  toggleVideo(enabled) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  // Register event handlers
  onIceCandidate(userId, callback) {
    const pc = this.peerConnections[userId]?.pc;
    if (pc) {
      pc.onicecandidate = event => {
        if (event.candidate) {
          callback(event.candidate);
        }
      };
    }
  }

  onRemoteTrack(userId, callback) {
    const pc = this.peerConnections[userId]?.pc;
    if (pc) {
      pc.ontrack = event => {
        callback(event.streams[0]);
      };
    }
  }

  onConnectionStateChange(userId, callback) {
    const pc = this.peerConnections[userId]?.pc;
    if (pc) {
      pc.onconnectionstatechange = () => {
        callback(pc.connectionState);
      };
    }
  }
}

export default new WebRTCService();
