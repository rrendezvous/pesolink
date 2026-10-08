import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { SignOutModal } from '../../src/components/SignOutModal';

export default function EmployerLogout() {
  const router = useRouter();
  const { logout } = useAuth();
  const [visible, setVisible] = useState(true);

  return (
    <View style={styles.container}>
      <SignOutModal
        visible={visible}
        onCancel={() => {
          setVisible(false);
          router.replace('/(employer)/dashboard');
        }}
        onConfirm={async () => {
          setVisible(false);
          await logout();
          router.replace('/');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
