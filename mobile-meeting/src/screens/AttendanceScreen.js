import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  FlatList,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { attendanceAPI } from '../services/api';

const AttendanceScreen = ({ navigation }) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tableType, setTableType] = useState('by-status'); // by-status, absent, summary

  useFocusEffect(
    React.useCallback(() => {
      loadAttendance();
    }, [])
  );

  const loadAttendance = async () => {
    try {
      if (tableType === 'by-status') {
        const response = await attendanceAPI.getAttendanceRecords();
        setRecords(response.data.records || []);
      } else if (tableType === 'absent') {
        const response = await attendanceAPI.getAbsentRecords();
        setRecords(response.data.absent || []);
      } else if (tableType === 'summary') {
        const response = await attendanceAPI.getAttendanceSummary();
        setRecords(response.data.summary || []);
      }
    } catch (error) {
      console.error('Error loading attendance:', error);
      Alert.alert('Error', 'Failed to load attendance data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadAttendance();
  }, [tableType]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAttendance();
  };

  const renderAttendanceItem = ({ item }) => (
    <View style={styles.recordCard}>
      <Text style={styles.recordTitle}>{item.user_name || item.full_name || item.meeting_title}</Text>
      {item.meeting_title && <Text style={styles.recordText}>Meeting: {item.meeting_title}</Text>}
      {item.status && (
        <Text
          style={[
            styles.recordStatus,
            {
              color: item.status === 'present' ? '#4CAF50' : '#f44336',
            },
          ]}
        >
          Status: {item.status.toUpperCase()}
        </Text>
      )}
      {item.join_time && (
        <Text style={styles.recordText}>
          Joined: {new Date(item.join_time).toLocaleTimeString()}
        </Text>
      )}
      {item.leave_time && (
        <Text style={styles.recordText}>
          Left: {new Date(item.leave_time).toLocaleTimeString()}
        </Text>
      )}
      {item.attendance_count && (
        <Text style={styles.recordText}>Total: {item.attendance_count}</Text>
      )}
      {item.absent_count && (
        <Text style={styles.recordText}>Absent: {item.absent_count}</Text>
      )}
    </View>
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
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, tableType === 'by-status' && styles.activeTab]}
          onPress={() => setTableType('by-status')}
        >
          <Text
            style={[
              styles.tabText,
              tableType === 'by-status' && styles.activeTabText,
            ]}
          >
            Records
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tableType === 'absent' && styles.activeTab]}
          onPress={() => setTableType('absent')}
        >
          <Text
            style={[
              styles.tabText,
              tableType === 'absent' && styles.activeTabText,
            ]}
          >
            Absent
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tableType === 'summary' && styles.activeTab]}
          onPress={() => setTableType('summary')}
        >
          <Text
            style={[
              styles.tabText,
              tableType === 'summary' && styles.activeTabText,
            ]}
          >
            Summary
          </Text>
        </TouchableOpacity>
      </View>

      {records.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No attendance records found</Text>
        </View>
      ) : (
        <FlatList
          data={records}
          renderItem={renderAttendanceItem}
          keyExtractor={(item, index) => index.toString()}
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
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#007AFF',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  recordCard: {
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
  recordTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  recordText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
  },
  recordStatus: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 3,
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
});

export default AttendanceScreen;
