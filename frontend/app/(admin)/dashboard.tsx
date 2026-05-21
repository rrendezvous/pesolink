// ============================================================
// Admin Dashboard
// ============================================================
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { api, getApiError } from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';
import { Colors, Spacing, FontSize } from '../../src/constants/theme';
import { confirmAction } from '../../src/utils/confirm';

export default function AdminDashboard() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await api.get('/admin/stats');
      setStats(res.data);
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      testID="admin-dashboard"
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>PESO MIS.OR</Text>
          <Text style={styles.headerTitle}>Admin Console</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} testID="admin-logout" style={styles.exitButton}>
          <Text style={styles.exitText}>Exit</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <View style={styles.officeCard}>
          <Text style={styles.officeLabel}>Employment Registration and Validation Support</Text>
          <Text style={styles.officeName}>PESO Misamis Oriental</Text>
          <Text style={styles.officeEmail}>{user?.email}</Text>
        </View>

        <Text style={styles.sectionTitle}>System Overview</Text>
        <View style={styles.statsGrid}>
          <BigStatCard label="Total Users" value={stats?.total_users ?? '-'} />
          <BigStatCard label="Job Seekers" value={stats?.total_job_seekers ?? '-'} />
          <BigStatCard label="Employers" value={stats?.total_employers ?? '-'} />
          <BigStatCard label="Total Jobs" value={stats?.total_jobs ?? '-'} />
          <BigStatCard label="Active Jobs" value={stats?.active_jobs ?? '-'} />
          <BigStatCard label="Applications" value={stats?.total_applications ?? '-'} />
        </View>

        <Text style={styles.sectionTitle}>Management</Text>
        <View style={styles.actionList}>
          <ActionButton testID="admin-manage-emp" label="Manage Employers" detail="Create and monitor employer accounts" onPress={() => router.push('/(admin)/manage-employers')} />
          <ActionButton testID="admin-manage-seekers" label="Manage Job Seekers" detail="Review NSRP and referral-ready status" onPress={() => router.push('/(admin)/manage-job-seekers')} />
          <ActionButton testID="admin-jobs" label="Monitor Job Posts" detail="View active and closed job posts" onPress={() => router.push('/(admin)/monitor-jobs')} />
          <ActionButton testID="admin-apps" label="Monitor Applications" detail="Read-only application tracking" onPress={() => router.push('/(admin)/monitor-apps')} />
        </View>

        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>Scope Reminder</Text>
          <Text style={styles.noteText}>
            OCR is optional and assistive. PESO Referral-Ready means the NSRP profile was reviewed for referral support.
            Skill comparison remains rule-based only and does not make hiring decisions.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function BigStatCard({ label, value }: { label: string; value: any }) {
  return (
    <View style={styles.bigStat}>
      <Text style={styles.bigStatValue}>{value}</Text>
      <Text style={styles.bigStatLabel}>{label}</Text>
    </View>
  );
}

function ActionButton({
  label, detail, onPress, testID,
}: { label: string; detail: string; onPress: () => void; testID?: string }) {
  return (
    <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.75} style={styles.actionBtn}>
      <View style={{ flex: 1 }}>
        <Text style={styles.actionText}>{label}</Text>
        <Text style={styles.actionDetail}>{detail}</Text>
      </View>
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
  exitButton: { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  exitText: { color: Colors.gray, fontSize: FontSize.xs, fontWeight: '800' },
  body: { padding: Spacing.md },
  officeCard: {
    backgroundColor: Colors.primary,
    borderRadius: 18,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  officeLabel: { color: Colors.cardHighlight, fontSize: FontSize.xs, fontWeight: '900', textTransform: 'uppercase' },
  officeName: { color: Colors.white, fontSize: FontSize.xl, fontWeight: '900', marginTop: 8 },
  officeEmail: { color: Colors.cardHighlight, fontSize: FontSize.sm, marginTop: 5 },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '900', color: Colors.textDark, marginTop: Spacing.sm, marginBottom: Spacing.sm },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  bigStat: {
    width: '48%',
    backgroundColor: Colors.white,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  bigStatValue: { fontSize: FontSize.xxl, fontWeight: '900', color: Colors.primary },
  bigStatLabel: { fontSize: FontSize.xs, color: Colors.textDark, marginTop: 4, fontWeight: '800' },
  actionList: { gap: Spacing.sm },
  actionBtn: {
    backgroundColor: Colors.white,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 64,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionText: { color: Colors.textDark, fontSize: FontSize.md, fontWeight: '900' },
  actionDetail: { color: Colors.gray, fontSize: FontSize.xs, marginTop: 3 },
  actionArrow: { color: Colors.primary, fontSize: FontSize.lg, fontWeight: '900', marginLeft: Spacing.sm },
  noteCard: {
    backgroundColor: Colors.cardHighlight,
    borderColor: Colors.primary,
    borderWidth: 1,
    borderRadius: 14,
    padding: Spacing.md,
    marginTop: Spacing.lg,
  },
  noteTitle: { color: Colors.primaryDark, fontSize: FontSize.sm, fontWeight: '900' },
  noteText: { color: Colors.textDark, fontSize: FontSize.sm, lineHeight: 20, marginTop: 6 },
});
