import React from 'react';
import { Stack } from 'expo-router';
import { Colors } from '../../src/constants/theme';

export default function EmployerLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: Colors.white,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: Colors.lightBg },
      }}
    >
      <Stack.Screen name="dashboard" options={{ title: 'Employer Dashboard' }} />
      <Stack.Screen name="manage-jobs" options={{ title: 'My Job Posts' }} />
      <Stack.Screen name="job-form" options={{ title: 'Create / Edit Job' }} />
      <Stack.Screen name="applicants" options={{ title: 'Job Applicants' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
    </Stack>
  );
}
