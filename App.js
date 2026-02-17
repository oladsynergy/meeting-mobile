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

const AppStack = () => (
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
    <Stack.Screen
      name="AdminSettings"
      component={AdminSettingsScreen}
      options={{ title: 'Admin Settings' }}
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
    <Stack.Screen
      name="AdminSettings"
      component={AdminSettingsScreen}
      options={{ title: 'Admin Settings' }}
    />
  </Stack.Navigator>
);

const RootNavigator = ({ userToken, isLoading }) => (
  <NavigationContainer>
    {isLoading ? (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    ) : userToken == null ? (
      <AuthStack />
    ) : (
      <AppStack />
    )}
  </NavigationContainer>
);

export default function App() {
  const [state, dispatch] = React.useReducer(
    (prevState, action) => {
      switch (action.type) {
        case 'RESTORE_TOKEN':
          return {
            ...prevState,
            userToken: action.payload,
            isLoading: false,
          };
        case 'SIGN_IN':
          return {
            ...prevState,
            isSignout: false,
            userToken: action.payload,
          };
        case 'SIGN_OUT':
          return {
            ...prevState,
            isSignout: true,
            userToken: null,
          };
      }
    },
    {
      isLoading: true,
      isSignout: false,
      userToken: null,
    }
  );

  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        dispatch({ type: 'RESTORE_TOKEN', payload: token });
      } catch (e) {
        console.error(e);
        dispatch({ type: 'RESTORE_TOKEN', payload: null });
      }
    };

    bootstrapAsync();
  }, []);

  return <RootNavigator userToken={state.userToken} isLoading={state.isLoading} />;
}
