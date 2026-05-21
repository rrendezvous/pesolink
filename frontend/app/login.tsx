// ============================================================
// Login Screen
// ============================================================
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Input, Card } from '../src/components/ui';
import { api, getApiError } from '../src/api/client';
import { useAuth } from '../src/context/AuthContext';
import { Colors, Spacing, FontSize } from '../src/constants/theme';

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Required', 'Please enter both email and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email: email.trim(), password });
      await login(res.data.token, res.data.user);
      const role = res.data.user.role;
      if (role === 'job_seeker') router.replace('/(seeker)/dashboard');
      else if (role === 'employer') router.replace('/(employer)/dashboard');
      else router.replace('/(admin)/dashboard');
    } catch (err: any) {
      Alert.alert('Sign In Failed', getApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: Colors.lightBg }}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Welcome back</Text>
        <Text style={styles.sub}>Sign in to access your PESO-Link account.</Text>

        <Input
          testID="login-email"
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
        />
        <Input
          testID="login-password"
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password"
          secureTextEntry
        />

        <Button
          testID="login-submit"
          title="Sign In"
          onPress={handleLogin}
          loading={loading}
        />

        <View style={{ marginTop: Spacing.lg }}>
          <Text style={styles.linkText} onPress={() => router.push('/register')} testID="go-register">
            New to PESO-Link? <Text style={styles.link}>Create an account</Text>
          </Text>
        </View>

        <Card style={{ marginTop: Spacing.xl, backgroundColor: Colors.surface }}>
          <Text style={styles.demoTitle}>Demo Accounts (IT323)</Text>
          <Text style={styles.demoLine}>Admin: admin@peso.gov.ph / Admin@123</Text>
          <Text style={styles.demoLine}>Seeker: juan.cruz@example.com / Test@123</Text>
          <Text style={styles.demoLine}>Employer: hr@techcorp.ph / Test@123</Text>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, paddingTop: Spacing.xl },
  heading: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textDark },
  sub: { fontSize: FontSize.sm, color: Colors.gray, marginTop: 4, marginBottom: Spacing.lg },
  linkText: { textAlign: 'center', color: Colors.textDark, fontSize: FontSize.sm },
  link: { color: Colors.primary, fontWeight: '700' },
  demoTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary, marginBottom: 6 },
  demoLine: { fontSize: FontSize.xs, color: Colors.gray, marginBottom: 2, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});
