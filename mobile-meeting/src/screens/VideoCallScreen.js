import React, { useState } from "react-native";
import { View, Text, TouchableOpacity, SafeAreaView, StyleSheet } from "react-native";
import { useRoute } from "@react-navigation/native";

export default function VideoCallScreen({ navigation }) {
  const route = useRoute();
  const { meetingTitle } = route.params || { meetingTitle: "Meeting" };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Video Call</Text>
      <View style={styles.content}>
        <Text style={styles.message}>Video conferencing requires a mobile device.</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  title: { fontSize: 18, fontWeight: "bold", padding: 16 },
  content: { flex: 1, justifyContent: "center", alignItems: "center" },
  message: { fontSize: 14, marginBottom: 20, textAlign: "center" },
  button: { paddingHorizontal: 24, paddingVertical: 12, backgroundColor: "#007AFF", borderRadius: 8 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
