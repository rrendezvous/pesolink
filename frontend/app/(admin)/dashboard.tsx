// ============================================================
// Admin Dashboard - simple counts only
// ============================================================
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Card } from '../../src/components/ui';
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

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      testID="admin-dashboard"
    >
      <View style={styles.welcomeCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.welcomeLabel}>PESO Admin Console</Text>
          <Text style={styles.welcomeName}>PESO Misamis Oriental</Text>
          <Text style={styles.welcomeEmail}>{user?.email}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} testID="admin-logout">
          <Text style={styles.logout}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {stats?.pending_employer_approvals > 0 && (
        <Card style={{ backgroundColor: '#FEF3C7', borderColor: Colors.warning }}>
          <Text style={{ fontWeight: '700', color: '#92400E' }}>
            {stats.pending_employer_approvals} employer{stats.pending_employer_approvals === 1 ? '' : 's'} awaiting approval
          </Text>
          <TouchableOpacity onPress={() => router.push('/(admin)/employer-approvals')}>
            <Text style={{ color: Colors.primary, marginTop: 4, fontWeight: '600', fontSize: FontSize.sm }}>
              Review now →
            </Text>
          </TouchableOpacity>
        </Card>
      )}

      <Text style={styles.sectionTitle}>System Overview</Text>
      <View style={styles.statsGrid}>
        <BigStatCard label="Total Users" value={stats?.total_users ?? '-'} />
        <BigStatCard label="Job Seekers" value={stats?.total_job_seekers ?? '-'} />
        <BigStatCard label="Employers" value={stats?.total_employers ?? '-'} />
        <BigStatCard label="Pending Approvals" value={stats?.pending_employer_approvals ?? '-'} highlight />
        <BigStatCard label="Total Jobs" value={stats?.total_jobs ?? '-'} />
        <BigStatCard label="Active Jobs" value={stats?.active_jobs ?? '-'} />
        <BigStatCard label="Applications" value={stats?.total_applications ?? '-'} />
      </View>

      <Text style={styles.sectionTitle}>Management</Text>
      <View style={{ gap: Spacing.sm }}>
        <ActionButton testID="admin-manage-emp" label="Manage Employers (create / view)" onPress={() => router.push('/(admin)/manage-employers')} />
        <ActionButton testID="admin-manage-seekers" label="Manage Job Seekers (deactivate / reactivate)" onPress={() => router.push('/(admin)/manage-job-seekers')} />
        <ActionButton testID="admin-approvals" label="Employer Approvals (legacy)" onPress={() => router.push('/(admin)/employer-approvals')} />
        <ActionButton testID="admin-jobs" label="Monitor Job Posts (close)" onPress={() => router.push('/(admin)/monitor-jobs')} />
        <ActionButton testID="admin-apps" label="Monitor Applications" onPress={() => router.push('/(admin)/monitor-apps')} />
      </View>

      <Text style={styles.footnote}>
        OCR is optional and assistive. Users must review and confirm extracted data before saving.
        Skill comparison is rule-based only. Status updates are tracking labels and do not represent
        automated hiring decisions.
      </Text>
    </ScrollView>
  );
}

function BigStatCard({ label, value, highlight }: { label: string; value: any; highlight?: boolean }) {
  return (
    <View style={[styles.bigStat, highlight && { backgroundColor: Colors.accent, borderColor: Colors.accent }]}>
      <Text style={[styles.bigStatValue, highlight && { color: Colors.white }]}>{value}</Text>
      <Text style={[styles.bigStatLabel, highlight && { color: Colors.white }]}>{label}</Text>
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
    backgroundColor: Colors.primaryDark, borderRadius: 12, padding: Spacing.md,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.lg,
  },
  welcomeLabel: { color: Colors.cardHighlight, fontSize: FontSize.sm },
  welcomeName: { color: Colors.white, fontSize: FontSize.xl, fontWeight: '700', marginTop: 2 },
  welcomeEmail: { color: Colors.cardHighlight, fontSize: FontSize.xs, marginTop: 4 },
  logout: { color: Colors.white, fontSize: FontSize.sm, textDecorationLine: 'underline' },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark, marginTop: Spacing.md, marginBottom: Spacing.sm },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bigStat: {
    width: '48%',
    backgroundColor: Colors.cardHighlight, borderColor: Colors.border, borderWidth: 1,
    borderRadius: 10, padding: 14,
  },
  bigStatValue: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.primary },
  bigStatLabel: { fontSize: FontSize.xs, color: Colors.textDark, marginTop: 2, fontWeight: '600' },
  actionBtn: {
    backgroundColor: Colors.white, borderColor: Colors.border, borderWidth: 1,
    borderRadius: 10, paddingVertical: 14, paddingHorizontal: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  actionText: { color: Colors.textDark, fontSize: FontSize.md, fontWeight: '600' },
  actionArrow: { color: Colors.primary, fontSize: 22, fontWeight: '700' },
  footnote: {
    fontSize: FontSize.xs, color: Colors.gray, marginTop: Spacing.xl, marginBottom: Spacing.lg,
    fontStyle: 'italic', textAlign: 'center', lineHeight: 16,
  },
});
