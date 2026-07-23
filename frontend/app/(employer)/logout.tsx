import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { confirmAction } from '../../src/utils/confirm';

export default function EmployerLogout() {
  const router = useRouter();
  const { logout } = useAuth();
  const promptedRef = useRef(false);

  useEffect(() => {
    if (promptedRef.current) return;
    promptedRef.current = true;

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
  }, []);

  return <View style={{ flex: 1 }} />;
}
