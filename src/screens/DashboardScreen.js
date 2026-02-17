import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { meetingAPI, userAPI } from '../services/api';
import { getUserData } from '../utils/storage';

const DashboardScreen = ({ navigation }) => {
  const [upcomingMeetings, setUpcomingMeetings] = useState([]);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      // Load user data
      const user = await getUserData();
      setUserData(user);

      // Load upcoming meetings
      const response = await meetingAPI.getMeetings({
        status: 'active',
        limit: 10,
      });
      setUpcomingMeetings(response.data.meetings || []);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      Alert.alert('Error', 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const renderMeetingItem = ({ item }) => (
    <TouchableOpacity
      style={styles.meetingCard}
      onPress={() => navigation.navigate('Meetings', {
        screen: 'MeetingDetail',
        params: { meetingId: item.id, meeting: item },
      })}
    >
      <View style={styles.meetingHeader}>
        <Text style={styles.meetingTitle}>{item.title}</Text>
        <Text style={[styles.badge, { backgroundColor: item.status === 'active' ? '#4CAF50' : '#FF9800' }]}>
          {item.status?.toUpperCase()}
        </Text>
      </View>
      <Text style={styles.meetingCode}>Code: {item.meeting_code}</Text>
      <Text style={styles.meetingDate}>
        {new Date(item.start_time).toLocaleString()}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Welcome, {userData?.full_name || 'User'}!</Text>
        <Text style={styles.subtitle}>Upcoming Meetings</Text>
      </View>

      {upcomingMeetings.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No upcoming meetings</Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => navigation.navigate('Meetings')}
          >
            <Text style={styles.createButtonText}>Create or Join a Meeting</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={upcomingMeetings}
          renderItem={renderMeetingItem}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 10,
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
  meetingHeader: {
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
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  meetingCode: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  meetingDate: {
    fontSize: 12,
    color: '#999',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 20,
    textAlign: 'center',
  },
  createButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default DashboardScreen;
