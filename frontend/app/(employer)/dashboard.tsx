// ============================================================
// Employer Dashboard
// ============================================================
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Card, EmptyState } from '../../src/components/ui';
import { api, getApiError } from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';
import { Colors, Spacing, FontSize } from '../../src/constants/theme';
import { confirmAction } from '../../src/utils/confirm';

export default function EmployerDashboard() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [p, j, n] = await Promise.all([
        api.get('/employer/profile'),
        api.get('/employer/jobs').catch(() => ({ data: { jobs: [] } })),
        api.get('/notifications'),
      ]);
      setProfile(p.data.profile);
      setJobs(j.data.jobs || []);
      setUnread(n.data.unread_count || 0);
    } catch (err) {
      console.warn(getApiError(err));
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleLogout = () => {
    confirmAction(
      'Sign out',
      'Are you sure?',
      async () => {
        await logout();
        router.replace('/');
      },
      'Sign out',
      true,
    );
  };

  const isPending = profile?.approval_status === 'pending';
  const isRejected = profile?.approval_status === 'rejected';
  const totalApplicants = jobs.reduce((sum, j) => sum + (j.applicant_count || 0), 0);
  const activeJobs = jobs.filter((j) => j.status === 'active').length;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      testID="employer-dashboard"
    >
      <View style={styles.welcomeCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.welcomeLabel}>Welcome,</Text>
          <Text style={styles.welcomeName}>{profile?.company_name || 'Employer'}</Text>
          <Text style={styles.welcomeEmail}>{user?.email}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} testID="emp-logout">
          <Text style={styles.logout}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {isPending && (
        <Card style={{ backgroundColor: '#FEF3C7', borderColor: Colors.warning }}>
          <Text style={{ fontWeight: '700', color: '#92400E' }}>Pending Approval</Text>
          <Text style={{ color: '#92400E', marginTop: 4, fontSize: FontSize.sm }}>
            Your employer account is pending PESO admin review. You cannot post jobs until approved.
          </Text>
        </Card>
      )}
      {isRejected && (
        <Card style={{ backgroundColor: '#FEE2E2', borderColor: Colors.error }}>
          <Text style={{ fontWeight: '700', color: '#991B1B' }}>Account Rejected</Text>
          <Text style={{ color: '#991B1B', marginTop: 4, fontSize: FontSize.sm }}>
            Please contact PESO admin for more information.
          </Text>
        </Card>
      )}

      <Text style={styles.sectionTitle}>Overview</Text>
      <View style={styles.statsRow}>
        <StatCard label="Job Posts" value={jobs.length} sub="total" />
        <StatCard label="Active" value={activeJobs} sub="open" />
        <StatCard label="Applicants" value={totalApplicants} sub="received" />
        <StatCard label="Alerts" value={unread} sub="new" />
      </View>

      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={{ gap: Spacing.sm }}>
        <ActionButton testID="action-manage" label="Manage Job Posts" onPress={() => router.push('/(employer)/manage-jobs')} />
        <ActionButton
          testID="action-new"
          label="+ Create New Job Post"
          onPress={() => {
            if (isPending) {
              Alert.alert('Approval Required', 'Your account must be approved by PESO admin before posting jobs.');
              return;
            }
            router.push('/(employer)/job-form');
          }}
        />
        <ActionButton testID="action-notif" label={`Notifications${unread > 0 ? ` (${unread})` : ''}`} onPress={() => router.push('/(employer)/notifications')} />
      </View>

      <Text style={styles.sectionTitle}>Recent Job Posts</Text>
      {jobs.length === 0 ? (
        <EmptyState message="You haven't posted any jobs yet." />
      ) : (
        jobs.slice(0, 3).map((j) => (
          <TouchableOpacity key={j.id} testID={`emp-job-${j.id}`} onPress={() => router.push({ pathname: '/(employer)/applicants', params: { jobId: j.id, jobTitle: j.job_title } })}>
            <Card>
              <Text style={{ fontWeight: '700', color: Colors.textDark, fontSize: FontSize.md }}>{j.job_title}</Text>
              <Text style={{ color: Colors.gray, fontSize: FontSize.sm, marginTop: 2 }}>
                {j.applicant_count || 0} applicant{j.applicant_count === 1 ? '' : 's'} • {j.status}
              </Text>
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
    backgroundColor: Colors.primary, borderRadius: 12, padding: Spacing.md,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.lg,
  },
  welcomeLabel: { color: Colors.cardHighlight, fontSize: FontSize.sm },
  welcomeName: { color: Colors.white, fontSize: FontSize.xl, fontWeight: '700', marginTop: 2 },
  welcomeEmail: { color: Colors.cardHighlight, fontSize: FontSize.xs, marginTop: 4 },
  logout: { color: Colors.white, fontSize: FontSize.sm, textDecorationLine: 'underline' },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark, marginTop: Spacing.md, marginBottom: Spacing.sm },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.md },
  statCard: { flex: 1, backgroundColor: Colors.cardHighlight, borderColor: Colors.border, borderWidth: 1, borderRadius: 10, padding: 12, alignItems: 'center' },
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
