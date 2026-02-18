import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  USER_TOKEN: 'userToken',
  USER_DATA: 'userData',
  BACKEND_URL: 'backendUrl',
  SIGNALING_URL: 'signalingUrl',
  MEETINGS_CACHE: 'meetingsCache',
  USERS_CACHE: 'usersCache',
  ATTENDANCE_CACHE: 'attendanceCache',
};

export const setToken = async (token) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.USER_TOKEN, token);
  } catch (error) {
    console.error('Error setting token:', error);
  }
};

export const getToken = async () => {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.USER_TOKEN);
  } catch (error) {
    console.error('Error getting token:', error);
    return null;
  }
};

export const clearToken = async () => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.USER_TOKEN);
  } catch (error) {
    console.error('Error clearing token:', error);
  }
};

export const setUserData = async (userData) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
  } catch (error) {
    console.error('Error setting user data:', error);
  }
};

export const getUserData = async () => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
};

export const clearUserData = async () => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
  } catch (error) {
    console.error('Error clearing user data:', error);
  }
};

export const setBackendUrl = async (url) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.BACKEND_URL, url);
  } catch (error) {
    console.error('Error setting backend URL:', error);
  }
};

export const getBackendUrl = async () => {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.BACKEND_URL) || 
      'https://meeting-backend-production-ba47.up.railway.app';
  } catch (error) {
    console.error('Error getting backend URL:', error);
    return 'https://meeting-backend-production-ba47.up.railway.app';
  }
};

export const setSignalingUrl = async (url) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.SIGNALING_URL, url);
  } catch (error) {
    console.error('Error setting signaling URL:', error);
  }
};

export const getSignalingUrl = async () => {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.SIGNALING_URL) || 
      'https://meeting-signaling-server-production.up.railway.app';
  } catch (error) {
    console.error('Error getting signaling URL:', error);
    return 'https://meeting-signaling-server-production.up.railway.app';
  }
};

// Cache functions
export const cacheMeetings = async (meetings) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.MEETINGS_CACHE, JSON.stringify(meetings));
  } catch (error) {
    console.error('Error caching meetings:', error);
  }
};

export const getCachedMeetings = async () => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.MEETINGS_CACHE);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting cached meetings:', error);
    return [];
  }
};

export const clearAllData = async () => {
  try {
    await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
  } catch (error) {
    console.error('Error clearing all data:', error);
  }
};

export default {
  setToken,
  getToken,
  clearToken,
  setUserData,
  getUserData,
  clearUserData,
  setBackendUrl,
  getBackendUrl,
  setSignalingUrl,
  getSignalingUrl,
  cacheMeetings,
  getCachedMeetings,
  clearAllData,
};
