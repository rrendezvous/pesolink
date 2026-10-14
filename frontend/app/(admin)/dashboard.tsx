// ============================================================
// Admin Dashboard
// Order follows the admin's job: what needs action, referral routing results,
// management shortcuts, then reference counts.
// ============================================================
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api, getApiError } from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';
import { Colors, Spacing, FontSize, Radius, Shadow, StatusColors } from '../../src/constants/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function AdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();
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

  const go = (screen: string) => router.navigate(`/(admin)/${screen}` as any);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const pendingNsrp = Number(stats?.pending_nsrp_reviews) || 0;
  const pendingEmployers = Number(stats?.pending_employer_approvals) || 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={[]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        testID="admin-dashboard"
      >
        <View style={styles.header}>
          <Text style={styles.kicker}>PESO-Link MisOr</Text>
          <Text style={styles.headerTitle}>Admin Console</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            PESO Misamis Oriental{user?.email ? ` · ${user.email}` : ''}
          </Text>
        </View>

        <View style={styles.body}>
          <Text style={styles.sectionTitle}>Needs Your Attention</Text>
          <View style={styles.stack}>
            {stats && pendingNsrp > 0 && (
              <AttentionCard
                testID="attn-nsrp"
                icon="hourglass-outline"
                title={`${plural(pendingNsrp, 'NSRP profile', 'NSRP profiles')} waiting`}
                detail="Check and verify them in the NSRP queue"
                onPress={() => go('manage-job-seekers')}
              />
            )}
            {stats && pendingEmployers > 0 && (
              <AttentionCard
                testID="attn-employers"
                icon="business-outline"
                title={`${plural(pendingEmployers, 'employer', 'employers')} waiting for approval`}
                detail="Approve or reject the new employer accounts"
                onPress={() => go('manage-employers')}
              />
            )}
            {stats && pendingNsrp === 0 && pendingEmployers === 0 && (
              <View style={styles.caughtUp} testID="attn-none">
                <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                <Text style={styles.caughtUpText}>All caught up. Nothing is waiting for PESO.</Text>
              </View>
            )}
          </View>

          <Text style={styles.sectionTitle}>Referral Routing</Text>
          <View style={styles.routingRow}>
            <RoutingCard
              testID="stat-nsrp-verified"
              icon="shield-checkmark-outline"
              value={stats?.verified_nsrp_profiles ?? '-'}
              label="PESO-Verified Seekers"
              onPress={() => go('manage-job-seekers')}
            />
            <RoutingCard
              testID="stat-referred"
              icon="document-text-outline"
              value={stats?.peso_referred_applications ?? '-'}
              label="PESO-Referred Applications"
              onPress={() => go('monitor-apps')}
            />
          </View>

          <Text style={styles.sectionTitle}>Manage</Text>
          <View style={styles.stack}>
            <ActionButton
              testID="action-employers"
              icon="business-outline"
              label="Employers"
              detail={stats ? plural(Number(stats.total_employers) || 0, 'account', 'accounts') : 'Create, approve and manage employer accounts'}
              onPress={() => go('manage-employers')}
            />
            <ActionButton
              testID="action-jobs"
              icon="briefcase-outline"
              label="Job Posts"
              detail={stats ? `${stats.active_jobs} active / ${stats.total_jobs} total` : 'Monitor and close job posts'}
              onPress={() => go('monitor-jobs')}
            />
          </View>

          <Text style={styles.sectionTitle}>System Overview</Text>
          <View style={styles.overviewCard} testID="system-overview">
            <OverviewItem icon="people-outline" value={stats?.total_users} label="Users" />
            <OverviewItem icon="person-outline" value={stats?.total_job_seekers} label="Job Seekers" />
            <OverviewItem icon="business-outline" value={stats?.total_employers} label="Employers" />
            <OverviewItem icon="briefcase-outline" value={stats?.total_jobs} label="Job Posts" />
            <OverviewItem icon="checkmark-done-outline" value={stats?.active_jobs} label="Active Jobs" />
            <OverviewItem icon="documents-outline" value={stats?.total_applications} label="Applications" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function AttentionCard({
  title, detail, icon, onPress, testID,
}: { title: string; detail: string; icon: IconName; onPress: () => void; testID?: string }) {
  return (
    <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.8} style={styles.attnCard} accessibilityRole="button">
      <View style={styles.attnIcon}>
        <Ionicons name={icon} size={20} color={StatusColors.needs_revision.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.attnTitle}>{title}</Text>
        <Text style={styles.attnDetail}>{detail}</Text>
      </View>
      <Text style={styles.attnAction}>Review</Text>
      <Ionicons name="chevron-forward" size={18} color={StatusColors.needs_revision.text} />
    </TouchableOpacity>
  );
}

function RoutingCard({
  value, label, icon, onPress, testID,
}: { value: any; label: string; icon: IconName; onPress: () => void; testID?: string }) {
  return (
    <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.75} style={styles.routingCard} accessibilityRole="button">
      <View style={styles.routingTop}>
        <Text style={styles.routingValue}>{value}</Text>
        <Ionicons name="chevron-forward" size={18} color={Colors.grayLight} />
      </View>
      <View style={styles.routingLabelRow}>
        <Ionicons name={icon} size={15} color={Colors.primary} style={styles.routingIcon} />
        <Text style={styles.routingLabel}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

function ActionButton({
  label, detail, onPress, testID, icon,
}: { label: string; detail: string; onPress: () => void; testID?: string; icon: IconName }) {
  return (
    <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.75} style={styles.actionBtn} accessibilityRole="button">
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={22} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.actionText}>{label}</Text>
        <Text style={styles.actionDetail}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
    </TouchableOpacity>
  );
}

function OverviewItem({ value, label, icon }: { value: any; label: string; icon: IconName }) {
  return (
    <View style={styles.overviewItem}>
      <Text style={styles.overviewValue}>{value ?? '-'}</Text>
      <View style={styles.overviewLabelRow}>
        <Ionicons name={icon} size={13} color={Colors.gray} style={styles.overviewIcon} />
        <Text style={styles.overviewLabel} numberOfLines={1}>{label}</Text>
      </View>
    </View>
  );
}

const amber = StatusColors.needs_revision;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.primaryDark },
  container: { flex: 1, backgroundColor: Colors.primaryDark },
  // flexGrow keeps the light background down to the tab bar when the page is shorter than the screen.
  content: { flexGrow: 1, backgroundColor: Colors.lightBg, paddingBottom: Spacing.xl },
  header: {
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  kicker: { color: Colors.cardHighlight, fontSize: FontSize.xs, fontWeight: '900' },
  headerTitle: { color: Colors.white, fontSize: FontSize.xl, fontWeight: '900', marginTop: 4 },
  headerSub: { color: Colors.cardHighlight, fontSize: FontSize.sm, marginTop: 4 },
  body: { padding: Spacing.md },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: '900',
    color: Colors.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  stack: { gap: Spacing.sm, marginBottom: Spacing.md },

  // Needs your attention: the only amber element, so it is seen first.
  attnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: amber.bg,
    borderColor: amber.border,
    borderWidth: 1,
    borderLeftWidth: 5,
    borderRadius: Radius.md,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  attnIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  attnTitle: { color: amber.text, fontSize: FontSize.md, fontWeight: '900' },
  attnDetail: { color: amber.text, fontSize: FontSize.xs, marginTop: 2, opacity: 0.85 },
  attnAction: { color: amber.text, fontSize: FontSize.sm, fontWeight: '900', marginLeft: Spacing.sm },
  caughtUp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.cardHighlight,
    borderRadius: Radius.md,
    padding: 14,
  },
  caughtUpText: { flex: 1, color: Colors.primaryDark, fontSize: FontSize.sm, fontWeight: '800' },

  // Referral routing: the two results of the routing flow, side by side.
  routingRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  routingCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderColor: Colors.borderSoft,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: 14,
    ...Shadow.card,
  },
  routingTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  routingValue: { fontSize: FontSize.xxl, fontWeight: '900', color: Colors.primary, fontVariant: ['tabular-nums'] },
  routingLabelRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 4 },
  routingIcon: { marginRight: 5, marginTop: 1 },
  routingLabel: { flex: 1, fontSize: FontSize.xs, color: Colors.textDark, fontWeight: '800' },

  // Manage shortcuts.
  actionBtn: {
    backgroundColor: Colors.white,
    borderColor: Colors.borderSoft,
    borderWidth: 1,
    borderRadius: Radius.md,
    minHeight: 64,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    backgroundColor: Colors.cardHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  actionText: { color: Colors.textDark, fontSize: FontSize.md, fontWeight: '900' },
  actionDetail: { color: Colors.gray, fontSize: FontSize.xs, marginTop: 3 },

  // System overview: reference counts, quieter than everything above.
  overviewCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: Colors.white,
    borderColor: Colors.borderSoft,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.sm,
  },
  overviewItem: { width: '33.33%', paddingVertical: 10, paddingHorizontal: 12 },
  overviewValue: { fontSize: FontSize.lg, fontWeight: '900', color: Colors.textDark, fontVariant: ['tabular-nums'] },
  overviewLabelRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  overviewIcon: { marginRight: 4 },
  overviewLabel: { flexShrink: 1, fontSize: FontSize.xs, color: Colors.gray, fontWeight: '700' },
});
