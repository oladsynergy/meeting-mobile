import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  FlatList,
  ActivityIndicator,
  Alert,
  TextInput,
  RefreshControl,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { userAPI } from '../services/api';
import { getUserData } from '../utils/storage';

const MembersScreen = ({ navigation }) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [userData, setUserData] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      loadMembers();
    }, [])
  );

  const loadMembers = async () => {
    try {
      const user = await getUserData();
      setUserData(user);

      // Check if user is admin or host
      if (user?.role !== 'admin' && user?.role !== 'host') {
        console.warn('[MEMBERS] User is not admin/host, access denied. Role:', user?.role);
        setIsAuthorized(false);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      setIsAuthorized(true);

      try {
        const response = await userAPI.getUsers();
        setMembers(response.data.users || []);
      } catch (error) {
        console.warn('[MEMBERS] API failed to load members, using mock data:', error.message);
        // Mock data fallback
        setMembers([
          {
            id: 1,
            full_name: 'System Administrator',
            email: 'admin@cooperative.local',
            role: 'admin',
            created_at: new Date().toISOString()
          }
        ]);
      }
    } catch (error) {
      console.error('[MEMBERS] Error loading members:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMembers();
  };

  const filteredMembers = members.filter(
    (m) =>
      m.full_name.toLowerCase().includes(searchText.toLowerCase()) ||
      m.email.toLowerCase().includes(searchText.toLowerCase())
  );

  const renderMemberItem = ({ item }) => (
    <View style={styles.memberCard}>
      <View>
        <Text style={styles.memberName}>{item.full_name}</Text>
        <Text style={styles.memberEmail}>{item.email}</Text>
        <Text style={styles.memberRole}>{item.role?.toUpperCase() || 'MEMBER'}</Text>
      </View>
      <Text style={styles.joinDate}>
        Joined: {new Date(item.created_at).toLocaleDateString()}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!isAuthorized) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.errorText}>Access Denied</Text>
        <Text style={styles.errorSubText}>Only admins and hosts can view members</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search members..."
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>

      {filteredMembers.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No members found</Text>
        </View>
      ) : (
        <FlatList
          data={filteredMembers}
          renderItem={renderMemberItem}
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
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  memberCard: {
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
  memberName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  memberEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  memberRole: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  joinDate: {
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
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f44336',
    marginBottom: 10,
  },
  errorSubText: {
    fontSize: 14,
    color: '#999',
  },
});

export default MembersScreen;
