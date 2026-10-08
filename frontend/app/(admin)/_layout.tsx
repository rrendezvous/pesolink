import React, { useState } from 'react';
import { TouchableOpacity } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { SignOutModal } from '../../src/components/SignOutModal';
import { Colors, FontSize } from '../../src/constants/theme';

function LogoutTabButton({ children, ...props }: any) {
  const router = useRouter();
  const { logout } = useAuth();
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <TouchableOpacity
        {...props}
        onPress={(e: any) => {
          e?.preventDefault?.();
          setShowModal(true);
        }}
      >
        {children}
      </TouchableOpacity>
      <SignOutModal
        visible={showModal}
        onCancel={() => setShowModal(false)}
        onConfirm={async () => {
          setShowModal(false);
          await logout();
          router.replace('/');
        }}
      />
    </>
  );
}

export default function AdminLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom || 0;
  const tabBarBottomPadding = Math.max(8 + bottomInset, 16);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Keep every tab screen below the phone's status bar; headers share this green.
        sceneStyle: { paddingTop: insets.top, backgroundColor: Colors.primaryDark },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.gray,
        tabBarShowLabel: true,
        tabBarLabelPosition: 'below-icon',
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
        tabBarHideOnKeyboard: false,
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
        name="monitor-jobs"
        options={{
          title: 'Jobs',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'briefcase' : 'briefcase-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="manage-job-seekers"
        options={{
          title: 'NSRP',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="employer-approvals"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="manage-employers"
        options={{
          title: 'Employers',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'business' : 'business-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="monitor-apps"
        options={{
          title: 'Referrals',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'document-text' : 'document-text-outline'} size={size} color={color} />
          ),
        }}
      />
      {/* Admin notifications tab */}
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'notifications' : 'notifications-outline'} size={size} color={color} />
          ),
        }}
      />
      {/* Sign-out tab — press opens SignOutModal via LogoutTabButton */}
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
    </Tabs>
  );
}

