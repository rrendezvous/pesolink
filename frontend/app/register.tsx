// ============================================================
// Register Screen - Job Seeker self-registration only
// Employer accounts are created exclusively by PESO Admin.
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

export default function Register() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [contact, setContact] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!email || !password) {
      Alert.alert('Required', 'Email and password are required.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }
    if (!firstName || !lastName) {
      Alert.alert('Required', 'First and last name are required.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/register', {
        email: email.trim(),
        password,
        role: 'job_seeker',
        profile: { first_name: firstName, last_name: lastName, contact_number: contact },
      });
      await login(res.data.token, res.data.user);
      router.replace('/(seeker)/dashboard');
    } catch (err: any) {
      Alert.alert('Registration Failed', getApiError(err));
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
        <Text style={styles.heading}>Create a Job Seeker account</Text>
        <Text style={styles.sub}>Register to access PESO MisOr job opportunities.</Text>

        <Card style={{ backgroundColor: Colors.surface }} testID="employer-notice">
          <Text style={styles.noticeTitle}>Employer Accounts</Text>
          <Text style={styles.noticeText}>
            Employer accounts are created by PESO Admin only. If you represent a company,
            please contact your local PESO Misamis Oriental office to request an account.
          </Text>
        </Card>

        <Input testID="reg-email" label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
        <Input testID="reg-password" label="Password (min 6 chars)" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••" />
        <Input testID="reg-confirm" label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="••••••" />
        <Input testID="reg-firstname" label="First Name" value={firstName} onChangeText={setFirstName} placeholder="Juan" autoCapitalize="words" />
        <Input testID="reg-lastname" label="Last Name" value={lastName} onChangeText={setLastName} placeholder="Cruz" autoCapitalize="words" />
        <Input testID="reg-contact" label="Contact Number" value={contact} onChangeText={setContact} placeholder="09xx xxx xxxx" keyboardType="phone-pad" />

        <Button testID="reg-submit" title="Create Account" onPress={handleRegister} loading={loading} />

        <Text style={styles.linkText} onPress={() => router.push('/login')} testID="go-login">
          Already have an account? <Text style={styles.link}>Sign in</Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xl },
  heading: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textDark },
  sub: { fontSize: FontSize.sm, color: Colors.gray, marginTop: 4, marginBottom: Spacing.md },
  noticeTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary, marginBottom: 6, textTransform: 'uppercase' },
  noticeText: { fontSize: FontSize.sm, color: Colors.textDark, lineHeight: 20 },
  linkText: { textAlign: 'center', color: Colors.textDark, fontSize: FontSize.sm, marginTop: Spacing.md },
  link: { color: Colors.primary, fontWeight: '700' },
});
