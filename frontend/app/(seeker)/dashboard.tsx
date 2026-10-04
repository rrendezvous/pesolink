// ============================================================
// Job Seeker Dashboard
// ============================================================
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Card, StatusBadge, EmptyState } from '../../src/components/ui';
import { api, getApiError } from '../../src/api/client';
import { currentStatus } from '../../src/utils/referral';
import { Colors, Spacing, FontSize, Radius, Shadow } from '../../src/constants/theme';

export default function SeekerDashboard() {
  const router = useRouter();
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

  const displayName = `${profile?.first_name || 'Job Seeker'} ${profile?.last_name || ''}`.trim();
  const profileComplete = !!profile?.profile_completed;
  const referredCount = applications.filter((a) => a.referral_status === 'peso_referred').length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      testID="seeker-dashboard"
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>PESO-Link MisOr</Text>
          <Text style={styles.headerTitle}>Overview</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Card style={styles.welcomeCard}>
          <Text style={styles.welcomeName}>Hello, {displayName}!</Text>
          <Text style={styles.welcomeSub}>
            {profileComplete
              ? 'Your NSRP profile is complete. You can request PESO referral for any job post.'
              : 'Complete the required NSRP profile fields to request PESO referral.'}
          </Text>
          <View style={[styles.referralBadge, profileComplete ? styles.badgeComplete : styles.badgeIncomplete]}>
            <Text style={[styles.referralBadgeText, profileComplete && { color: Colors.white }]}>
              {profileComplete ? 'NSRP Profile Complete' : 'NSRP Profile Incomplete'}
            </Text>
          </View>
          {!profile?.profile_completed && (
            <TouchableOpacity testID="complete-profile" onPress={() => router.push('/(seeker)/profile')} style={styles.noticePill}>
              <Text style={styles.noticePillText}>Complete NSRP Profile</Text>
            </TouchableOpacity>
          )}
        </Card>

        <View style={styles.primaryActions}>
          <ActionTile
            testID="action-jobs"
            label="Find Jobs"
            icon="🔍"
            primary
            onPress={() => router.push('/(seeker)/jobs')}
          />
          <ActionTile
            testID="action-applications"
            label="My Applications"
            icon="📋"
            onPress={() => router.push('/(seeker)/my-applications')}
          />
        </View>

        <View style={styles.statsRow}>
          <StatCard label="Profile" value={profile?.profile_completed ? 'OK' : 'Open'} sub={profile?.profile_completed ? 'Complete' : 'Incomplete'} />
          <StatCard label="Skills" value={skills.length} sub="encoded" />
          <StatCard label="Referred" value={referredCount} sub="by PESO" />
        </View>

        {/* Quick Actions moved to Profile / Jobs via bottom navigation; removed to avoid duplication */}

        <Text style={styles.sectionTitle}>Recent Referral Requests</Text>
        {applications.length === 0 ? (
          <EmptyState message="No referral requests yet. Find a job and tap Request PESO Referral." />
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
                  <Text style={styles.applicationDate}>Requested {new Date(a.applied_at).toLocaleDateString()}</Text>
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

function StatCard({ label, value, sub }: { label: string; value: any; sub: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statSub}>{sub}</Text>
    </View>
  );
}

function ActionTile({
  label, icon, onPress, testID, primary,
}: { label: string; icon: string; onPress: () => void; testID?: string; primary?: boolean }) {
  return (
    <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.78} style={[styles.actionTile, primary && styles.actionTilePrimary]}>
      <Text style={[styles.actionTileIcon, primary && styles.actionTileIconPrimary]}>{icon}</Text>
      <Text style={[styles.actionTileText, primary && styles.actionTileTextPrimary]}>{label}</Text>
    </TouchableOpacity>
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
  badgeComplete: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  badgeIncomplete: { backgroundColor: '#FEF3C7', borderColor: Colors.warning },
  container: { flex: 1, backgroundColor: Colors.primaryDark },
  content: { flexGrow: 1, backgroundColor: Colors.lightBg, paddingBottom: Spacing.xl },
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
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: Colors.gray, fontSize: FontSize.xs, fontWeight: '800' },
  body: { padding: Spacing.md },
  welcomeCard: {
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    marginBottom: Spacing.md,
  },
  welcomeName: { fontSize: FontSize.lg, fontWeight: '900', color: Colors.textDark },
  welcomeSub: { fontSize: FontSize.sm, color: Colors.gray, marginTop: 8, lineHeight: 20 },
  referralBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: Spacing.md,
  },
  referralBadgeText: { color: Colors.textDark, fontSize: FontSize.xs, fontWeight: '900' },
  noticePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderColor: Colors.warning,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: Spacing.md,
  },
  noticePillText: { color: '#92400E', fontSize: FontSize.xs, fontWeight: '900' },
  primaryActions: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  actionTile: {
    flex: 1,
    minHeight: 92,
    backgroundColor: Colors.white,
    borderColor: Colors.borderSoft,
    borderWidth: 1,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  actionTilePrimary: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  actionTileIcon: { color: Colors.primary, fontSize: FontSize.xl, fontWeight: '900', marginBottom: 6 },
  actionTileIconPrimary: { color: Colors.white },
  actionTileText: { color: Colors.textDark, fontSize: FontSize.sm, fontWeight: '900', textAlign: 'center' },
  actionTileTextPrimary: { color: Colors.white },
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
  statLabel: { fontSize: FontSize.xs, color: Colors.gray, fontWeight: '900' },
  statValue: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.textDark, marginTop: 4 },
  statSub: { fontSize: 10, color: Colors.gray, marginTop: 2 },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '900', color: Colors.textDark, marginBottom: Spacing.sm, marginTop: Spacing.sm },
  actionList: { gap: Spacing.sm, marginBottom: Spacing.lg },
  actionBtn: {
    backgroundColor: Colors.white,
    borderColor: Colors.borderSoft,
    borderWidth: 1,
    borderRadius: Radius.md,
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionText: { color: Colors.textDark, fontSize: FontSize.md, fontWeight: '800' },
  actionArrow: { color: Colors.primary, fontSize: FontSize.lg, fontWeight: '900' },
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
    width: 52, height: 52, borderRadius: Radius.md,
    backgroundColor: Colors.cardHighlight,
    alignItems: 'center', justifyContent: 'center',
    marginRight: Spacing.md,
  },
  companyMarkText: { color: Colors.primary, fontWeight: '900', fontSize: FontSize.xl },
  applicationTitle: { fontWeight: '900', color: Colors.textDark, fontSize: FontSize.md },
  applicationCompany: { color: Colors.gray, fontSize: FontSize.sm, marginTop: 2 },
  applicationDate: { color: Colors.gray, fontSize: FontSize.xs, marginTop: 4 },
});
