import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';

export default function VideoCallScreen({ navigation }) {
  if (Platform.OS === 'web') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' }}>
          Video Calling
        </Text>
        <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 30 }}>
          Video conferencing is only available on mobile devices.
        </Text>
        <Text style={{ fontSize: 12, color: '#999', textAlign: 'center', marginBottom: 30 }}>
          Please use the mobile app (Android/iOS) to join video calls.
        </Text>
        <TouchableOpacity 
          style={{ paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#007AFF', borderRadius: 8 }}
          onPress={() => navigation.goBack()}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Return a placeholder for native - the real implementation will load when not on web
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Loading Video Call...</Text>
    </View>
  );
}
