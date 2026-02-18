import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import MeetingsScreen from './src/screens/MeetingsScreen';
import MeetingDetailScreen from './src/screens/MeetingDetailScreen';
import MembersScreen from './src/screens/MembersScreen';
import AttendanceScreen from './src/screens/AttendanceScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import VideoCallScreen from './src/screens/VideoCallScreen';
import AdminSettingsScreen from './src/screens/AdminSettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const AuthStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      animationEnabled: true,
    }}
  >
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Register" component={RegisterScreen} />
  </Stack.Navigator>
);

const MeetingsStack = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="MeetingsList"
      component={MeetingsScreen}
      options={{ title: 'Meetings' }}
    />
    <Stack.Screen
      name="MeetingDetail"
      component={MeetingDetailScreen}
      options={{ title: 'Meeting Details' }}
    />
    <Stack.Screen
      name="VideoCall"
      component={VideoCallScreen}
      options={{
        title: 'Video Call',
        headerShown: false,
        animationEnabled: true,
      }}
    />
  </Stack.Navigator>
);

const SettingsStack = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="SettingsMain"
      component={SettingsScreen}
      options={{ title: 'Settings' }}
    />
  </Stack.Navigator>
);

const AdminSettingsStack = ({ userRole }) => (
  <Stack.Navigator>
    <Stack.Screen
      name="AdminSettingsMain"
      component={AdminSettingsScreen}
      options={{ title: 'Admin Settings' }}
    />
  </Stack.Navigator>
);

// Member Stack - for regular members (no admin features)
const MemberAppStack = ({ userRole }) => (
  <Tab.Navigator
    screenOptions={{
      headerShown: true,
      tabBarActiveTintColor: '#007AFF',
      tabBarInactiveTintColor: '#8E8E93',
    }}
  >
    <Tab.Screen
      name="Dashboard"
      component={DashboardScreen}
      options={{
        title: 'Home',
        tabBarLabel: 'Home',
      }}
    />
    <Tab.Screen
      name="Meetings"
      component={MeetingsStack}
      options={{
        title: 'Meetings',
        tabBarLabel: 'Meetings',
        headerShown: false,
      }}
    />
    <Tab.Screen
      name="Settings"
      component={SettingsStack}
      options={{
        title: 'Settings',
        tabBarLabel: 'Settings',
        headerShown: false,
      }}
    />
  </Tab.Navigator>
);

// Admin/Host Stack - for admins and hosts (includes admin features)
const AdminAppStack = ({ userRole }) => (
  <Tab.Navigator
    screenOptions={{
      headerShown: true,
      tabBarActiveTintColor: '#007AFF',
      tabBarInactiveTintColor: '#8E8E93',
    }}
  >
    <Tab.Screen
      name="Dashboard"
      component={DashboardScreen}
      options={{
        title: 'Home',
        tabBarLabel: 'Home',
      }}
    />
    <Tab.Screen
      name="Meetings"
      component={MeetingsStack}
      options={{
        title: 'Meetings',
        tabBarLabel: 'Meetings',
        headerShown: false,
      }}
    />
    <Tab.Screen
      name="Members"
      component={MembersScreen}
      options={{
        title: 'Members',
        tabBarLabel: 'Members',
      }}
    />
    <Tab.Screen
      name="Attendance"
      component={AttendanceScreen}
      options={{
        title: 'Attendance',
        tabBarLabel: 'Attendance',
      }}
    />
    <Tab.Screen
      name="Settings"
      component={SettingsStack}
      options={{
        title: 'Settings',
        tabBarLabel: 'Settings',
        headerShown: false,
      }}
    />
  </Tab.Navigator>
);

const RootNavigator = ({ userToken, userRole, isLoading }) => (
  <NavigationContainer>
    {isLoading ? (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    ) : userToken == null ? (
      <AuthStack />
    ) : userRole === 'admin' || userRole === 'host' ? (
      <AdminAppStack userRole={userRole} />
    ) : (
      <MemberAppStack userRole={userRole} />
    )}
  </NavigationContainer>
);

export default function App() {
  const [state, dispatch] = React.useReducer(
    (prevState, action) => {
      console.log('[APP] Reducer action:', action.type, 'Token:', action.payload?.token ? action.payload.token.substring(0, 20) + '...' : 'null', 'Role:', action.payload?.role);
      switch (action.type) {
        case 'RESTORE_TOKEN':
          return {
            ...prevState,
            userToken: action.payload.token,
            userRole: action.payload.role,
            isLoading: false,
          };
        case 'SIGN_IN':
          return {
            ...prevState,
            isSignout: false,
            userToken: action.payload.token,
            userRole: action.payload.role,
          };
        case 'SIGN_OUT':
          return {
            ...prevState,
            isSignout: true,
            userToken: null,
            userRole: null,
          };
      }
    },
    {
      isLoading: true,
      isSignout: false,
      userToken: null,
      userRole: null,
    }
  );

  const tokenRef = React.useRef(state.userToken);
  const roleRef = React.useRef(state.userRole);

  useEffect(() => {
    tokenRef.current = state.userToken;
    roleRef.current = state.userRole;
  }, [state.userToken, state.userRole]);

  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        console.log('[APP] Checking for existing token...');
        const token = await AsyncStorage.getItem('userToken');
        const userDataStr = await AsyncStorage.getItem('userData');
        const userData = userDataStr ? JSON.parse(userDataStr) : null;
        const role = userData?.role || null;
        
        console.log('[APP] Found token:', token ? token.substring(0, 20) + '...' : 'null');
        console.log('[APP] Found role:', role);
        
        dispatch({ type: 'RESTORE_TOKEN', payload: { token, role } });
      } catch (e) {
        console.error('[APP] Error restoring token:', e);
        dispatch({ type: 'RESTORE_TOKEN', payload: { token: null, role: null } });
      }
    };

    bootstrapAsync();

    // Poll for token changes (check every 2 seconds)
    const interval = setInterval(async () => {
      try {
        const currentToken = await AsyncStorage.getItem('userToken');
        const userDataStr = await AsyncStorage.getItem('userData');
        const userData = userDataStr ? JSON.parse(userDataStr) : null;
        const currentRole = userData?.role || null;
        
        if (currentToken !== tokenRef.current || currentRole !== roleRef.current) {
          console.log('[APP] Token/Role changed!', 'Token:', currentToken ? currentToken.substring(0, 20) + '...' : 'null', 'Role:', currentRole);
          
          if (currentToken) {
            dispatch({ type: 'SIGN_IN', payload: { token: currentToken, role: currentRole } });
          } else {
            dispatch({ type: 'SIGN_OUT' });
          }
        }
      } catch (e) {
        console.error('[APP] Token check error:', e);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return <RootNavigator userToken={state.userToken} userRole={state.userRole} isLoading={state.isLoading} />;
}
