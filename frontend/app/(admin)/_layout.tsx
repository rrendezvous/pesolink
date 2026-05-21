import React from 'react';
import { Stack } from 'expo-router';
import { Colors } from '../../src/constants/theme';

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: Colors.white,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: Colors.lightBg },
      }}
    >
      <Stack.Screen name="dashboard" options={{ title: 'PESO Admin' }} />
      <Stack.Screen name="employer-approvals" options={{ title: 'Employer Approvals' }} />
      <Stack.Screen name="manage-employers" options={{ title: 'Manage Employers' }} />
      <Stack.Screen name="manage-job-seekers" options={{ title: 'Manage Job Seekers' }} />
      <Stack.Screen name="monitor-jobs" options={{ title: 'All Job Posts' }} />
      <Stack.Screen name="monitor-apps" options={{ title: 'All Applications' }} />
    </Stack>
  );
}
