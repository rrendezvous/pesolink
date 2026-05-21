import React from 'react';
import { Stack } from 'expo-router';
import { Colors } from '../../src/constants/theme';

export default function SeekerLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: Colors.white,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: Colors.lightBg },
      }}
    >
      <Stack.Screen name="dashboard" options={{ title: 'My Dashboard' }} />
      <Stack.Screen name="profile" options={{ title: 'NSRP Profile' }} />
      <Stack.Screen name="upload-nsrp" options={{ title: 'Upload NSRP Form' }} />
      <Stack.Screen name="jobs" options={{ title: 'Browse Jobs' }} />
      <Stack.Screen name="job/[id]" options={{ title: 'Job Details' }} />
      <Stack.Screen name="my-applications" options={{ title: 'My Applications' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
    </Stack>
  );
}
