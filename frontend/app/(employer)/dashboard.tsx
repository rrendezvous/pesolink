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
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      testID="employer-dashboard"
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>PESO MIS.OR</Text>
          <Text style={styles.headerTitle}>Overview</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} testID="emp-logout" style={styles.avatar}>
          <Text style={styles.avatarText}>Exit</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <View style={styles.companyCard}>
          <Text style={styles.companyName}>{profile?.company_name || 'Employer'}</Text>
          <Text style={styles.companyEmail}>{user?.email}</Text>
          <View style={styles.verifiedPill}>
            <Text style={styles.verifiedText}>{profile?.approval_status === 'approved' ? 'Verified Partner' : 'PESO Managed Account'}</Text>
          </View>
        </View>

        {isPending && (
          <Card style={styles.warningCard}>
            <Text style={styles.warningTitle}>Pending Approval</Text>
            <Text style={styles.warningText}>Your employer account is pending PESO admin review. You cannot post jobs until approved.</Text>
          </Card>
        )}
        {isRejected && (
          <Card style={styles.rejectedCard}>
            <Text style={styles.rejectedTitle}>Account Rejected</Text>
            <Text style={styles.rejectedText}>Please contact PESO admin for more information.</Text>
          </Card>
        )}

        <View style={styles.statsRow}>
          <StatCard label="Created Jobs" value={jobs.length} />
          <StatCard label="Active Jobs" value={activeJobs} />
          <StatCard label="Applicants" value={totalApplicants} />
        </View>

        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionList}>
          <ActionButton testID="action-manage" label="Manage Job Posts" onPress={() => router.push('/(employer)/manage-jobs')} />
          <ActionButton
            testID="action-new"
            label="Post New Job"
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
            <TouchableOpacity key={j.id} testID={`emp-job-${j.id}`} onPress={() => router.push({ pathname: '/(employer)/applicants', params: { jobId: j.id, jobTitle: j.job_title } })} activeOpacity={0.85} style={styles.jobCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.jobTitle}>{j.job_title}</Text>
                <Text style={styles.jobMeta}>{j.applicant_count || 0} applicant{j.applicant_count === 1 ? '' : 's'} / {j.status}</Text>
              </View>
              <Text style={styles.manageLink}>Manage</Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function StatCard({ label, value }: { label: string; value: any }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function ActionButton({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  return (
    <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.75} style={styles.actionBtn}>
      <Text style={styles.actionText}>{label}</Text>
      <Text style={styles.actionArrow}>{'>'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primaryDark },
  content: { backgroundColor: Colors.lightBg, paddingBottom: Spacing.xl },
  header: {
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kicker: { color: Colors.cardHighlight, fontSize: FontSize.xs, fontWeight: '900' },
  headerTitle: { color: Colors.white, fontSize: FontSize.xl, fontWeight: '900', marginTop: 4 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Colors.gray, fontSize: FontSize.xs, fontWeight: '800' },
  body: { padding: Spacing.md },
  companyCard: {
    backgroundColor: Colors.primary,
    borderRadius: 18,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  companyName: { color: Colors.white, fontSize: FontSize.xl, fontWeight: '900' },
  companyEmail: { color: Colors.cardHighlight, fontSize: FontSize.sm, marginTop: 5 },
  verifiedPill: {
    alignSelf: 'flex-start',
    borderColor: Colors.accent,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: Spacing.md,
  },
  verifiedText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: '900' },
  warningCard: { backgroundColor: '#FEF3C7', borderColor: Colors.warning },
  warningTitle: { fontWeight: '900', color: '#92400E' },
  warningText: { color: '#92400E', marginTop: 4, fontSize: FontSize.sm, lineHeight: 20 },
  rejectedCard: { backgroundColor: '#FEE2E2', borderColor: Colors.error },
  rejectedTitle: { fontWeight: '900', color: '#991B1B' },
  rejectedText: { color: '#991B1B', marginTop: 4, fontSize: FontSize.sm },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  statCard: { flex: 1, backgroundColor: Colors.white, borderColor: Colors.border, borderWidth: 1, borderRadius: 14, padding: 14 },
  statLabel: { fontSize: FontSize.xs, color: Colors.gray, fontWeight: '900', textTransform: 'uppercase' },
  statValue: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.textDark, marginTop: 8 },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '900', color: Colors.textDark, marginTop: Spacing.sm, marginBottom: Spacing.sm },
  actionList: { gap: Spacing.sm, marginBottom: Spacing.lg },
  actionBtn: {
    backgroundColor: Colors.white, borderColor: Colors.border, borderWidth: 1,
    borderRadius: 13, minHeight: 52, paddingVertical: 14, paddingHorizontal: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  actionText: { color: Colors.textDark, fontSize: FontSize.md, fontWeight: '800' },
  actionArrow: { color: Colors.primary, fontSize: FontSize.lg, fontWeight: '900' },
  jobCard: {
    backgroundColor: Colors.white,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  jobTitle: { color: Colors.textDark, fontSize: FontSize.md, fontWeight: '900' },
  jobMeta: { color: Colors.gray, fontSize: FontSize.sm, marginTop: 4, textTransform: 'capitalize' },
  manageLink: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '900' },
});
