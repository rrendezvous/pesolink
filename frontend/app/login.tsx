// ============================================================
// Login Screen
// ============================================================
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert, TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Input, Card } from '../src/components/ui';
import { api, getApiError } from '../src/api/client';
import { useAuth } from '../src/context/AuthContext';
import { Colors, Spacing, FontSize, Radius } from '../src/constants/theme';

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();
  const [loginMode, setLoginMode] = useState<'Job Seeker' | 'Employer' | 'Admin'>('Job Seeker');
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
      style={{ flex: 1, backgroundColor: Colors.primaryDark }}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topBlock}>
          <Text style={styles.kicker}>PESO-Link MisOr</Text>
          <Text style={styles.title}>Welcome</Text>
          <Text style={styles.subtitle}>Enter your account details to continue.</Text>
        </View>

        <View style={styles.sheet}>
          <View style={styles.segment}>
            {(['Job Seeker', 'Employer', 'Admin'] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                testID={`login-mode-${mode.toLowerCase().replace(' ', '-')}`}
                onPress={() => setLoginMode(mode)}
                activeOpacity={0.75}
                style={[styles.segmentItem, loginMode === mode && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, loginMode === mode && styles.segmentTextActive]}>{mode}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.modeNote}>
            {loginMode === 'Job Seeker'
              ? 'Use your registered job seeker account.'
              : loginMode === 'Employer'
                ? 'Employer accounts are created by PESO Admin.'
                : 'PESO Admin access only.'}
          </Text>

          <Input
            testID="login-email"
            label="Email / Login ID"
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
            style={{ marginTop: Spacing.md }}
          />

          <Text style={styles.linkText} onPress={() => router.push('/register')} testID="go-register">
            New job seeker? <Text style={styles.link}>Create an account</Text>
          </Text>

          <Card style={styles.demoCard}>
            <Text style={styles.demoTitle}>Demo Accounts</Text>
            <Text style={styles.demoLine}>Admin: admin@peso.gov.ph / Admin@123</Text>
            <Text style={styles.demoLine}>Seeker: juan.cruz@example.com / Test@123</Text>
            <Text style={styles.demoLine}>Employer: hr@techcorp.ph / Test@123</Text>
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, backgroundColor: Colors.lightBg },
  topBlock: {
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xl,
  },
  kicker: { color: Colors.cardHighlight, fontSize: FontSize.xs, fontWeight: '800', marginBottom: Spacing.md },
  title: { fontSize: FontSize.xxxl, fontWeight: '900', color: Colors.white },
  subtitle: { fontSize: FontSize.md, color: Colors.cardHighlight, marginTop: 6, lineHeight: 22 },
  sheet: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    marginTop: -Spacing.md,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: Colors.cardHighlight,
    borderRadius: Radius.md,
    padding: 4,
    marginBottom: Spacing.sm,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
  },
  segmentActive: {
    backgroundColor: Colors.white,
  },
  segmentText: {
    color: Colors.gray,
    fontSize: FontSize.xs,
    fontWeight: '800',
    textAlign: 'center',
  },
  segmentTextActive: {
    color: Colors.primaryDark,
  },
  modeNote: { color: Colors.gray, fontSize: FontSize.xs, marginBottom: Spacing.lg, lineHeight: 16 },
  linkText: { textAlign: 'center', color: Colors.textDark, fontSize: FontSize.sm, marginTop: Spacing.lg },
  link: { color: Colors.primary, fontWeight: '800' },
  demoCard: { marginTop: Spacing.xl, backgroundColor: Colors.white },
  demoTitle: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.primary, marginBottom: 6 },
  demoLine: { fontSize: FontSize.xs, color: Colors.gray, marginBottom: 2, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});
