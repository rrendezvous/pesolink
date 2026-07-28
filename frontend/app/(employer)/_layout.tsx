import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { confirmAction } from '../../src/utils/confirm';
import { Colors, FontSize } from '../../src/constants/theme';

function LogoutTabButton({ children, ...props }: any) {
  const router = useRouter();
  const { logout } = useAuth();

  return (
    <TouchableOpacity
      {...props}
      onPress={() => {
        confirmAction(
          'Sign out',
          'Are you sure you want to sign out?',
          async () => {
            await logout();
            router.replace('/');
          },
          'Sign out',
          true,
        );
      }}
    >
      {children}
    </TouchableOpacity>
  );
}

export default function EmployerLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom || 0;
  const tabBarBottomPadding = Math.max(8 + bottomInset, 16);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.gray,
        tabBarStyle: {
          height: 64 + bottomInset,
          paddingTop: 6,
          paddingBottom: tabBarBottomPadding,
          borderTopWidth: 0,
          backgroundColor: Colors.white,
          shadowColor: '#0F2F26',
          shadowOpacity: 0.06,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: -3 },
          elevation: 6,
        },
        tabBarItemStyle: { paddingVertical: 2, marginHorizontal: 2 },
        tabBarLabelStyle: { fontSize: FontSize.xs, fontWeight: '700' },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="manage-jobs"
        options={{
          title: 'Jobs',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'briefcase' : 'briefcase-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="applicants"
        options={{
          title: 'Applicants',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'notifications' : 'notifications-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="logout"
        options={{
          title: 'Exit',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'log-out' : 'log-out-outline'} size={size} color={color} />
          ),
          tabBarButton: (props) => <LogoutTabButton {...props} />,
        }}
      />
      {/* Hidden: job form should be accessed via Manage Jobs / Post flow, keep route but hide */}
      <Tabs.Screen name="job-form" options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
    </Tabs>
  );
}
