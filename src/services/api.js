import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'https://meeting-backend-production-ba47.up.railway.app';
const API_TIMEOUT = process.env.REACT_APP_API_TIMEOUT || 30000;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: parseInt(API_TIMEOUT, 10),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error retrieving token:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle responses
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      await AsyncStorage.removeItem('userToken');
      // Optionally navigate to login
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const authAPI = {
  login: (email, password, platform = 'mobile') =>
    api.post('/auth/login', { email, password, platform }),
  register: (email, password, fullName) =>
    api.post('/auth/register', { email, password, full_name: fullName }),
};

// User endpoints
export const userAPI = {
  getUsers: () => api.get('/users'),
  getUserById: (id) => api.get(`/users/${id}`),
  updateUser: (id, userData) => api.put(`/users/${id}`, userData),
  deleteUser: (id) => api.delete(`/users/${id}`),
  getCurrentUser: async () => {
    // Get current user from token or saved data
    const userData = await AsyncStorage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
  },
};

// Meeting endpoints
export const meetingAPI = {
  getMeetings: (filters = {}) =>
    api.get('/meetings', { params: filters }),
  getMeetingByCode: (code) =>
    api.get(`/meetings/code/${code}`),
  createMeeting: (meetingData) =>
    api.post('/meetings', meetingData),
  updateMeeting: (id, meetingData) =>
    api.put(`/meetings/${id}`, meetingData),
  deleteMeeting: (id) =>
    api.delete(`/meetings/${id}`),
  lockMeeting: (id) =>
    api.post(`/meetings/${id}/lock`, {}),
  endMeeting: (id) =>
    api.post(`/meetings/${id}/end`, {}),
  getMeetingSettings: (id) =>
    api.get(`/meetings/${id}/settings`),
  updateMeetingSettings: (id, settings) =>
    api.put(`/meetings/${id}/settings`, settings),
};

// Attendance endpoints
export const attendanceAPI = {
  joinMeeting: (meetingId, userData) =>
    api.post('/attendance/join', { meeting_id: meetingId, ...userData }),
  leaveMeeting: (meetingId) =>
    api.post('/attendance/leave', { meeting_id: meetingId }),
  getAttendanceByMeeting: (meetingId) =>
    api.get(`/attendance/by-meeting/${meetingId}`),
  getAttendanceByUser: (userId) =>
    api.get(`/attendance/by-user/${userId}`),
  getAttendanceSummary: (filters = {}) =>
    api.get('/attendance/summary', { params: filters }),
  getAttendanceRecords: (filters = {}) =>
    api.get('/attendance/records', { params: filters }),
  getAbsentRecords: (filters = {}) =>
    api.get('/attendance/absent', { params: filters }),
  getMemberStats: (meetingId) =>
    api.get(`/attendance/member-stats?meeting_id=${meetingId}`),
};

// Health check
export const healthCheck = () =>
  api.get('/health');

// WebRTC Signaling Socket
let signalingSocket = null;

export const getSignalingSocket = () => {
  if (!signalingSocket) {
    const io = require('socket.io-client').default || require('socket.io-client');
    const SIGNALING_SERVER_URL = process.env.REACT_APP_SIGNALING_SERVER_URL || 
      'https://meeting-signaling-server-production.up.railway.app';
    
    signalingSocket = io(SIGNALING_SERVER_URL, {
      transport: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    signalingSocket.on('connect', () => {
      console.log('[Socket.io] Connected to signaling server');
    });

    signalingSocket.on('disconnect', () => {
      console.log('[Socket.io] Disconnected from signaling server');
    });

    signalingSocket.on('error', (error) => {
      console.error('[Socket.io] Error:', error);
    });
  }

  return signalingSocket;
};

export const disconnectSignaling = () => {
  if (signalingSocket) {
    signalingSocket.disconnect();
    signalingSocket = null;
  }
};

export default api;
