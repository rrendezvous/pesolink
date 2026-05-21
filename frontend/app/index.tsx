// ============================================================
// Welcome/Landing Screen - redirects to dashboard if logged in
// ============================================================
import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Colors, Spacing, FontSize } from '../src/constants/theme';
import { Button } from '../src/components/ui';

export default function Index() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (user) {
      if (user.role === 'job_seeker') router.replace('/(seeker)/dashboard');
      else if (user.role === 'employer') router.replace('/(employer)/dashboard');
      else if (user.role === 'admin') router.replace('/(admin)/dashboard');
    }
  }, [user, loading]);

  if (loading || user) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>PESO</Text>
        </View>
        <Text testID="app-title" style={styles.title}>PESO-Link MisOr</Text>
        <Text style={styles.subtitle}>Employment Registration & Validation Support</Text>
        <Text style={styles.tagline}>
          Public Employment Service Office{'\n'}Misamis Oriental
        </Text>
      </View>

      <View style={styles.featuresCard}>
        <Text style={styles.featuresTitle}>What you can do</Text>
        <FeatureRow icon="•" text="Find local job vacancies in Misamis Oriental" />
        <FeatureRow icon="•" text="Apply directly and track your applications" />
        <FeatureRow icon="•" text="Build your NSRP-based profile" />
        <FeatureRow icon="•" text="Employers post and manage jobs after PESO approval" />
      </View>

      <View style={styles.actions}>
        <Button
          testID="login-cta"
          title="Sign In"
          onPress={() => router.push('/login')}
        />
        <View style={{ height: Spacing.sm }} />
        <Button
          testID="register-cta"
          title="Create Account"
          variant="secondary"
          onPress={() => router.push('/register')}
        />
      </View>

      <Text style={styles.footer}>
        IT323 — Applications Development and Emerging Technology
      </Text>
    </ScrollView>
  );
}

function FeatureRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', marginBottom: 6 }}>
      <Text style={{ color: Colors.primary, marginRight: 8, fontSize: FontSize.md }}>{icon}</Text>
      <Text style={{ color: Colors.textDark, flex: 1, fontSize: FontSize.sm, lineHeight: 20 }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.lightBg },
  content: { padding: Spacing.lg, paddingTop: Spacing.xl + 20 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.lightBg },
  hero: { alignItems: 'center', marginBottom: Spacing.xl },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.md,
  },
  logoText: { color: Colors.white, fontSize: FontSize.lg, fontWeight: '800' },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textDark },
  subtitle: { fontSize: FontSize.md, color: Colors.primary, marginTop: 4, fontWeight: '600' },
  tagline: { fontSize: FontSize.sm, color: Colors.gray, marginTop: 12, textAlign: 'center', lineHeight: 18 },
  featuresCard: {
    backgroundColor: Colors.cardHighlight,
    borderColor: Colors.border, borderWidth: 1,
    borderRadius: 12, padding: Spacing.md, marginBottom: Spacing.lg,
  },
  featuresTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark, marginBottom: 10 },
  actions: { marginBottom: Spacing.lg },
  footer: {
    textAlign: 'center', color: Colors.gray, fontSize: FontSize.xs,
    marginTop: Spacing.md, marginBottom: Spacing.md,
  },
});
