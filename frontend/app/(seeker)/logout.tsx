import React, { useCallback, useRef } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { confirmAction } from '../../src/utils/confirm';

export default function SeekerLogout() {
  const router = useRouter();
  const { logout } = useAuth();
  const confirmedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (confirmedRef.current) return undefined;

      confirmAction(
        'Sign out',
        'Are you sure you want to sign out?',
        async () => {
          confirmedRef.current = true;
          await logout();
          router.replace('/');
        },
        'Sign out',
        true,
      );

      return undefined;
    }, [logout, router]),
  );

  return <View style={{ flex: 1 }} />;
}
