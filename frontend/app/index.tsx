// ============================================================
// Welcome / Intro Screen - redirects to dashboard if logged in
// ============================================================
import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Colors, Spacing, FontSize } from '../src/constants/theme';

const caseShadow = Platform.OS === 'web'
  ? { boxShadow: '0px 0px 30px rgba(56, 244, 163, 0.28)' }
  : {
      boxShadow: '0px 0px 30px rgba(56, 244, 163, 0.28)',
      elevation: 8,
    };

const primaryButtonShadow = Platform.OS === 'web'
  ? { boxShadow: '0px 8px 14px rgba(2, 44, 34, 0.24)' }
  : {
      boxShadow: '0px 8px 14px rgba(2, 44, 34, 0.24)',
      elevation: 4,
    };

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
    return <SplashState />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.brandArea}>
        <BriefcaseMark size="large" />
        <View style={styles.titleBlock}>
          <Text testID="app-title" style={styles.title}>PESO-Link MisOr</Text>
          <Text style={styles.titleAccent}>Mobile</Text>
        </View>
        <Text style={styles.description}>
          Employment registration and validation support for PESO Misamis Oriental.
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          testID="login-cta"
          onPress={() => router.push('/login')}
          activeOpacity={0.82}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="register-cta"
          onPress={() => router.push('/register')}
          activeOpacity={0.75}
          style={styles.signUpRow}
        >
          <Text style={styles.signUpText}>Don&apos;t have an account?</Text>
          <Text style={styles.signUpLink}> Sign Up</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SplashState() {
  return (
    <View style={styles.container}>
      <View style={styles.splashCenter}>
        <BriefcaseMark size="compact" />
        <Text style={styles.splashTitle}>PESO-Link MisOr</Text>
        <Text style={styles.splashSub}>Provincial Job Portal</Text>
        <ActivityIndicator color={Colors.white} size="small" style={{ marginTop: Spacing.xl }} />
      </View>
    </View>
  );
}

function BriefcaseMark({ size }: { size: 'compact' | 'large' }) {
  const large = size === 'large';
  return (
    <View style={[styles.markWrap, large ? styles.markWrapLarge : styles.markWrapCompact]}>
      <View style={[styles.handle, large ? styles.handleLarge : styles.handleCompact]} />
      <View style={[styles.caseBody, large ? styles.caseBodyLarge : styles.caseBodyCompact]}>
        <View style={styles.caseLid} />
        <View style={[styles.caseLatch, large ? styles.caseLatchLarge : styles.caseLatchCompact]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xl,
  },
  brandArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: Spacing.lg,
  },
  splashCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markWrapLarge: {
    width: 230,
    height: 230,
    marginBottom: Spacing.xl,
  },
  markWrapCompact: {
    width: 190,
    height: 190,
    marginBottom: Spacing.lg,
  },
  handle: {
    position: 'absolute',
    top: 34,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 22,
    borderBottomWidth: 0,
    borderColor: '#063B31',
    zIndex: 1,
  },
  handleLarge: {
    width: 82,
    height: 68,
  },
  handleCompact: {
    width: 72,
    height: 58,
  },
  caseBody: {
    backgroundColor: '#22A678',
    borderRadius: 28,
    overflow: 'hidden',
    zIndex: 2,
    ...caseShadow,
  },
  caseBodyLarge: {
    width: 220,
    height: 156,
  },
  caseBodyCompact: {
    width: 190,
    height: 136,
  },
  caseLid: {
    height: 58,
    backgroundColor: '#3FDEA0',
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    borderTopWidth: 5,
    borderTopColor: '#52E6A9',
  },
  caseLatch: {
    position: 'absolute',
    alignSelf: 'center',
    top: 48,
    backgroundColor: '#D8FCEB',
    borderRadius: 999,
  },
  caseLatchLarge: {
    width: 20,
    height: 34,
  },
  caseLatchCompact: {
    width: 18,
    height: 30,
  },
  titleBlock: {
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  title: {
    color: Colors.white,
    fontSize: FontSize.xxxl,
    fontWeight: '900',
    textAlign: 'center',
  },
  titleAccent: {
    color: Colors.accent,
    fontSize: FontSize.xxxl,
    fontWeight: '900',
    marginTop: -6,
    textAlign: 'center',
  },
  description: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: '800',
    lineHeight: 22,
    letterSpacing: 0,
    marginTop: Spacing.md,
    maxWidth: 330,
    textAlign: 'center',
  },
  actions: {
    paddingBottom: Spacing.lg,
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...primaryButtonShadow,
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  signUpRow: {
    minHeight: 52,
    marginTop: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  signUpText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
  signUpLink: {
    color: Colors.accent,
    fontSize: FontSize.sm,
    fontWeight: '900',
  },
  splashTitle: {
    color: Colors.white,
    fontSize: FontSize.xl,
    fontWeight: '900',
    textAlign: 'center',
  },
  splashSub: {
    color: Colors.white,
    fontSize: FontSize.xs,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: Spacing.sm,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});
