// ============================================================
// Job Seeker Dashboard
// Order: NSRP status and next step, main actions, progress counts, recent applications.
// ============================================================
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, StatusBadge, EmptyState } from '../../src/components/ui';
import { api, getApiError } from '../../src/api/client';
import { currentStatus, nsrpStatusMessage } from '../../src/utils/referral';
import { Colors, Spacing, FontSize, Radius, Shadow, StatusColors } from '../../src/constants/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const amber = StatusColors.needs_revision;

export default function SeekerDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [skills, setSkills] = useState<any[]>([]);
  const [requirements, setRequirements] = useState<any>(null);
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
      setRequirements(pRes.data.referral_requirements || null);
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

  const displayName = `${profile?.first_name || 'Job Seeker'} ${profile?.last_name || ''}`.trim();
  const profileComplete = !!profile?.profile_completed;
  const nsrpStatus: string = profile?.nsrp_status || 'not_submitted';
  const verified = nsrpStatus === 'verified';
  const needsAction = ['not_submitted', 'needs_revision'].includes(nsrpStatus);
  const referredCount = applications.filter((a) => a.referral_status === 'peso_referred').length;
  const itemsText = requirements
    ? `${requirements.filled_count}/${requirements.required_count}`
    : profileComplete ? 'Done' : '-';

  // Green when verified, amber when the seeker must act, neutral while PESO is checking.
  const tone = verified ? 'green' : needsAction ? 'amber' : 'neutral';
  const statusTitle = verified
    ? 'NSRP profile verified by PESO'
    : nsrpStatus === 'needs_revision'
      ? 'PESO returned your NSRP profile'
      : nsrpStatus === 'not_submitted'
        ? 'Your NSRP profile is not submitted yet'
        : 'PESO is checking your NSRP profile';
  const statusIcon: IconName = verified ? 'shield-checkmark' : needsAction ? 'alert-circle' : 'hourglass-outline';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      testID="seeker-dashboard"
    >
      <View style={styles.header}>
        <Text style={styles.kicker}>PESO-Link MisOr</Text>
        <Text style={styles.headerTitle}>Hello, {displayName}!</Text>
      </View>

      <View style={styles.body}>
        <View
          style={[styles.statusCard, tone === 'green' && styles.statusGreen, tone === 'amber' && styles.statusAmber]}
          testID="nsrp-status-card"
        >
          <View style={styles.statusTop}>
            <Ionicons
              name={statusIcon}
              size={22}
              color={tone === 'amber' ? amber.text : tone === 'green' ? Colors.primary : Colors.gray}
            />
            <Text style={[styles.statusTitle, tone === 'amber' && { color: amber.text }]}>{statusTitle}</Text>
          </View>
          <Text style={[styles.statusText, tone === 'amber' && { color: amber.text }]}>{nsrpStatusMessage(nsrpStatus)}</Text>
          {needsAction && (
            <TouchableOpacity testID="complete-profile" onPress={() => router.push('/(seeker)/profile')} style={styles.statusAction} accessibilityRole="button">
              <Text style={styles.statusActionText}>
                {nsrpStatus === 'needs_revision' ? 'Fix and Resubmit NSRP Profile' : profileComplete ? 'Submit NSRP Profile to PESO' : 'Complete NSRP Profile'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.white} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.primaryActions}>
          <ActionTile testID="action-jobs" icon="search" label="Find Jobs" primary onPress={() => router.push('/(seeker)/jobs')} />
          <ActionTile testID="action-applications" icon="document-text-outline" label="My Applications" onPress={() => router.push('/(seeker)/my-applications')} />
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity
            testID="unread-alerts"
            onPress={() => router.push('/(seeker)/notifications')}
            style={styles.alertsRow}
            accessibilityRole="button"
          >
            <Ionicons name="notifications" size={18} color={Colors.primary} />
            <Text style={styles.alertsText}>
              {unreadCount} new {unreadCount === 1 ? 'alert' : 'alerts'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
          </TouchableOpacity>
        )}

        <Text style={styles.sectionTitle}>My Progress</Text>
        <View style={styles.statsRow}>
          <StatCard icon="document-text-outline" value={itemsText} label="NSRP items" onPress={() => router.push('/(seeker)/profile')} />
          <StatCard icon="construct-outline" value={skills.length} label="Skills" onPress={() => router.push('/(seeker)/profile')} />
          <StatCard icon="checkmark-circle-outline" value={referredCount} label="PESO-Referred" onPress={() => router.push('/(seeker)/my-applications')} />
        </View>

        <Text style={styles.sectionTitle}>Recent Applications</Text>
        {applications.length === 0 ? (
          <EmptyState
            message={verified
              ? 'No applications yet. Find a job and tap Apply with PESO Referral.'
              : 'No applications yet. Once PESO verifies your NSRP profile, find a job and tap Apply with PESO Referral.'}
          />
        ) : (
          <Card style={styles.applicationsCard}>
            {applications.slice(0, 3).map((a) => (
              <TouchableOpacity key={a.id} onPress={() => router.push(`/(seeker)/job/${a.job_post_id}`)} testID={`app-card-${a.id}`} style={styles.applicationItem}>
                <View style={styles.companyMark}>
                  <Text style={styles.companyMarkText}>{(a.company_name || 'P').charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.applicationTitle}>{a.job_title}</Text>
                  <Text style={styles.applicationCompany}>{a.company_name}</Text>
                  <Text style={styles.applicationDate}>Applied {new Date(a.applied_at).toLocaleDateString()}</Text>
                </View>
                <StatusBadge status={currentStatus(a).status} />
              </TouchableOpacity>
            ))}
          </Card>
        )}
      </View>
    </ScrollView>
  );
}

function StatCard({
  icon, value, label, onPress,
}: { icon: IconName; value: any; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.statCard} onPress={onPress} activeOpacity={0.75} accessibilityRole="button">
      <Text style={styles.statValue}>{value}</Text>
      <View style={styles.statLabelRow}>
        <Ionicons name={icon} size={14} color={Colors.primary} style={{ marginRight: 4 }} />
        <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

function ActionTile({
  label, onPress, testID, primary, icon,
}: { label: string; onPress: () => void; testID?: string; primary?: boolean; icon: IconName }) {
  return (
    <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.78} style={[styles.actionTile, primary && styles.actionTilePrimary]} accessibilityRole="button">
      <Ionicons name={icon} size={20} color={primary ? Colors.white : Colors.primary} />
      <Text style={[styles.actionTileText, primary && styles.actionTileTextPrimary]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primaryDark },
  content: { flexGrow: 1, backgroundColor: Colors.lightBg, paddingBottom: Spacing.xl },
  header: {
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  kicker: { color: Colors.cardHighlight, fontSize: FontSize.xs, fontWeight: '900' },
  headerTitle: { color: Colors.white, fontSize: FontSize.xl, fontWeight: '900', marginTop: 4 },
  body: { padding: Spacing.md },

  // NSRP status: colour follows the state.
  statusCard: {
    backgroundColor: Colors.white,
    borderColor: Colors.borderSoft,
    borderWidth: 1,
    borderLeftWidth: 5,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.card,
  },
  statusGreen: { borderColor: Colors.primary, backgroundColor: Colors.white },
  statusAmber: { borderColor: amber.border, backgroundColor: amber.bg },
  statusTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  statusTitle: { flex: 1, fontSize: FontSize.md, fontWeight: '900', color: Colors.textDark },
  statusText: { fontSize: FontSize.sm, color: Colors.gray, marginTop: 6, lineHeight: 20 },
  statusAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: Spacing.md,
  },
  statusActionText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '900' },

  primaryActions: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  actionTile: {
    flex: 1,
    minHeight: 56,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: Colors.white,
    borderColor: Colors.borderSoft,
    borderWidth: 1,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
    ...Shadow.card,
  },
  actionTilePrimary: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  actionTileText: { color: Colors.textDark, fontSize: FontSize.md, fontWeight: '800', textAlign: 'center' },
  actionTileTextPrimary: { color: Colors.white },

  alertsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.cardHighlight,
    borderRadius: Radius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: Spacing.md,
  },
  alertsText: { flex: 1, color: Colors.primaryDark, fontSize: FontSize.sm, fontWeight: '800' },

  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: '900',
    color: Colors.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderColor: Colors.borderSoft,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: 12,
    ...Shadow.card,
  },
  statValue: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.primary, fontVariant: ['tabular-nums'] },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  statLabel: { flexShrink: 1, fontSize: FontSize.xs, color: Colors.textDark, fontWeight: '800' },

  applicationsCard: { padding: Spacing.sm },
  applicationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderColor: Colors.borderSoft,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  companyMark: {
    width: 44, height: 44, borderRadius: Radius.md,
    backgroundColor: Colors.cardHighlight,
    alignItems: 'center', justifyContent: 'center',
    marginRight: Spacing.md,
  },
  companyMarkText: { color: Colors.primary, fontWeight: '900', fontSize: FontSize.lg },
  applicationTitle: { fontWeight: '900', color: Colors.textDark, fontSize: FontSize.md },
  applicationCompany: { color: Colors.gray, fontSize: FontSize.sm, marginTop: 2 },
  applicationDate: { color: Colors.gray, fontSize: FontSize.xs, marginTop: 4 },
});
