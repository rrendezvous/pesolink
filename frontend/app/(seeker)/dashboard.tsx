// ============================================================
// Job Seeker Dashboard
// ============================================================
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Card, Button, StatusBadge, EmptyState } from '../../src/components/ui';
import { api, getApiError } from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';
import { Colors, Spacing, FontSize } from '../../src/constants/theme';
import { confirmAction } from '../../src/utils/confirm';

export default function SeekerDashboard() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [skills, setSkills] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [pRes, aRes, nRes] = await Promise.all([
        api.get('/job-seeker/profile'),
        api.get('/applications/my-applications'),
        api.get('/notifications'),
      ]);
      setProfile(pRes.data.profile);
      setSkills(pRes.data.skills || []);
      setApplications(aRes.data.applications || []);
      setUnreadCount(nRes.data.unread_count || 0);
    } catch (err: any) {
      console.warn('Dashboard load error:', getApiError(err));
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleLogout = () => {
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
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      testID="seeker-dashboard"
    >
      <View style={styles.welcomeCard}>
        <View>
          <Text style={styles.welcomeLabel}>Welcome back,</Text>
          <Text style={styles.welcomeName}>
            {profile?.first_name || 'Job Seeker'} {profile?.last_name || ''}
          </Text>
          <Text style={styles.welcomeEmail}>{user?.email}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} testID="seeker-logout">
          <Text style={styles.logout}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Stats</Text>
        <View style={styles.statsRow}>
          <StatCard label="Profile" value={profile?.profile_completed ? '✓' : '!'} sub={profile?.profile_completed ? 'Complete' : 'Incomplete'} />
          <StatCard label="Skills" value={skills.length} sub="added" />
          <StatCard label="Apps" value={applications.length} sub="submitted" />
          <StatCard label="New" value={unreadCount} sub="alerts" />
        </View>
      </View>

      {!profile?.profile_completed && (
        <Card style={{ backgroundColor: '#FEF3C7', borderColor: Colors.warning }}>
          <Text style={{ fontWeight: '700', color: '#92400E' }}>Complete your NSRP profile</Text>
          <Text style={{ color: '#92400E', marginTop: 4, fontSize: FontSize.sm }}>
            A complete profile is required to apply for jobs.
          </Text>
        </Card>
      )}

      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={{ gap: Spacing.sm, marginBottom: Spacing.lg }}>
        <ActionButton testID="action-jobs" label="Browse Jobs" onPress={() => router.push('/(seeker)/jobs')} />
        <ActionButton testID="action-profile" label="NSRP Profile & Skills" onPress={() => router.push('/(seeker)/profile')} />
        <ActionButton testID="action-upload" label="Upload NSRP Form (OCR)" onPress={() => router.push('/(seeker)/upload-nsrp')} />
        <ActionButton testID="action-applications" label="My Applications" onPress={() => router.push('/(seeker)/my-applications')} />
        <ActionButton testID="action-notifications" label={`Notifications${unreadCount > 0 ? ` (${unreadCount})` : ''}`} onPress={() => router.push('/(seeker)/notifications')} />
      </View>

      <Text style={styles.sectionTitle}>Recent Applications</Text>
      {applications.length === 0 ? (
        <EmptyState message="You haven't applied to any jobs yet." />
      ) : (
        applications.slice(0, 3).map((a) => (
          <TouchableOpacity key={a.id} onPress={() => router.push(`/(seeker)/job/${a.job_post_id}`)} testID={`app-card-${a.id}`}>
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={{ fontWeight: '700', color: Colors.textDark, fontSize: FontSize.md }}>{a.job_title}</Text>
                  <Text style={{ color: Colors.gray, fontSize: FontSize.sm, marginTop: 2 }}>{a.company_name}</Text>
                  <Text style={{ color: Colors.gray, fontSize: FontSize.xs, marginTop: 4 }}>
                    Applied {new Date(a.applied_at).toLocaleDateString()}
                  </Text>
                </View>
                <StatusBadge status={a.application_status} />
              </View>
            </Card>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

function StatCard({ label, value, sub }: { label: string; value: any; sub: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statSub}>{sub}</Text>
    </View>
  );
}

function ActionButton({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  return (
    <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.7} style={styles.actionBtn}>
      <Text style={styles.actionText}>{label}</Text>
      <Text style={styles.actionArrow}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.lightBg, padding: Spacing.md },
  welcomeCard: {
    backgroundColor: Colors.primary,
    borderRadius: 12, padding: Spacing.md,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  welcomeLabel: { color: Colors.cardHighlight, fontSize: FontSize.sm },
  welcomeName: { color: Colors.white, fontSize: FontSize.xl, fontWeight: '700', marginTop: 2 },
  welcomeEmail: { color: Colors.cardHighlight, fontSize: FontSize.xs, marginTop: 4 },
  logout: { color: Colors.white, fontSize: FontSize.sm, textDecorationLine: 'underline' },
  section: { marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark, marginBottom: Spacing.sm, marginTop: Spacing.sm },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1, backgroundColor: Colors.cardHighlight,
    borderColor: Colors.border, borderWidth: 1, borderRadius: 10,
    padding: 12, alignItems: 'center',
  },
  statValue: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.primary },
  statLabel: { fontSize: FontSize.xs, color: Colors.textDark, marginTop: 2, fontWeight: '600' },
  statSub: { fontSize: 10, color: Colors.gray },
  actionBtn: {
    backgroundColor: Colors.white, borderColor: Colors.border, borderWidth: 1,
    borderRadius: 10, paddingVertical: 14, paddingHorizontal: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  actionText: { color: Colors.textDark, fontSize: FontSize.md, fontWeight: '600' },
  actionArrow: { color: Colors.primary, fontSize: 22, fontWeight: '700' },
});
