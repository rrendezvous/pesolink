// ============================================================
// Employer Dashboard
// ============================================================
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Card, EmptyState, Button, Input, Chip, StatusBadge } from '../../src/components/ui';
import { api, getApiError } from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, Radius, Shadow, StatusColors } from '../../src/constants/theme';

const amber = StatusColors.needs_revision;

export default function EmployerDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});
  // PESO-referred applicants still For Review, per job (null until loaded).
  const [waitingByJob, setWaitingByJob] = useState<Record<number, number> | null>(null);

  const load = async () => {
    try {
      const [p, j, n] = await Promise.all([
        api.get('/employer/profile'),
        api.get('/employer/jobs').catch(() => ({ data: { jobs: [] } })),
        api.get('/notifications'),
      ]);
      setProfile(p.data.profile);
      const jobList = j.data.jobs || [];
      setJobs(jobList);
      setUnread(n.data.unread_count || 0);

      // Count applicants waiting for review using the existing applicant list of each job that has any.
      const withApplicants = jobList.filter((job: any) => job.status === 'active' && Number(job.applicant_count) > 0);
      const counts = await Promise.all(withApplicants.map(async (job: any) => {
        try {
          const r = await api.get(`/employer/jobs/${job.id}/applicants`);
          return [job.id, (r.data.applicants || []).filter((a: any) => a.application_status === 'for_review').length];
        } catch {
          return [job.id, 0];
        }
      }));
      setWaitingByJob(Object.fromEntries(counts));
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

  const openEdit = () => {
    setForm({
      company_name: profile?.company_name || '',
      company_address: profile?.company_address || '',
      contact_person: profile?.contact_person || '',
      contact_number: profile?.contact_number || '',
      business_type: profile?.business_type || '',
      company_size: profile?.company_size || '',
    });
    setEditing(true);
  };

  const setField = (key: string, value: string) => setForm((f: any) => ({ ...f, [key]: value }));

  const saveProfile = async () => {
    if (!form.company_name?.trim()) {
      Alert.alert('Required', 'Company name is required.');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/employer/profile', form);
      setProfile(res.data.profile);
      setEditing(false);
      Alert.alert('Saved', 'Company profile updated. Job seekers will see these details on your job posts.');
    } catch (err) {
      Alert.alert('Error', getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const isPending = profile?.approval_status === 'pending';
  const isRejected = profile?.approval_status === 'rejected';
  const totalApplicants = jobs.reduce((sum, j) => sum + (j.applicant_count || 0), 0);
  const activeJobs = jobs.filter((j) => j.status === 'active').length;
  const waitingJobs = waitingByJob ? jobs.filter((j) => (waitingByJob[j.id] || 0) > 0) : [];
  const waitingTotal = waitingJobs.reduce((sum, j) => sum + (waitingByJob?.[j.id] || 0), 0);

  const openWaiting = () => {
    if (waitingJobs.length === 1) {
      const j = waitingJobs[0];
      router.push({ pathname: '/(employer)/applicants', params: { jobId: j.id, jobTitle: j.job_title } });
    } else {
      router.push({ pathname: '/(employer)/applicants', params: { jobId: '', jobTitle: '' } });
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ ...styles.content, flexGrow: 1, paddingBottom: Spacing.xxl + 80 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      testID="employer-dashboard"
    >
      <View style={styles.header}>
        <Text style={styles.kicker}>PESO-Link MisOr</Text>
        <Text style={styles.headerTitle} numberOfLines={2}>{profile?.company_name || 'Employer'}</Text>
        <View style={styles.headerMetaRow}>
          <View style={styles.verifiedPill}>
            <Ionicons
              name={profile?.approval_status === 'approved' ? 'shield-checkmark' : 'time-outline'}
              size={13}
              color={Colors.white}
            />
            <Text style={styles.verifiedText}>
              {profile?.approval_status === 'approved' ? 'Verified Partner' : 'PESO Managed Account'}
            </Text>
          </View>
          <Text style={styles.headerEmail} numberOfLines={1}>{user?.email}</Text>
        </View>
      </View>

      <View style={styles.body}>
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

        {!isPending && !isRejected && waitingByJob && (
          <>
            <Text style={styles.sectionTitle}>Needs Your Attention</Text>
            {waitingTotal > 0 ? (
              <TouchableOpacity testID="attn-applicants" onPress={openWaiting} activeOpacity={0.8} style={styles.attnCard} accessibilityRole="button">
                <View style={styles.attnIcon}>
                  <Ionicons name="people-outline" size={20} color={amber.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.attnTitle}>
                    {waitingTotal} {waitingTotal === 1 ? 'applicant' : 'applicants'} waiting for review
                  </Text>
                  <Text style={styles.attnDetail}>
                    {waitingJobs.length === 1 ? waitingJobs[0].job_title : `Across ${waitingJobs.length} job posts`} · PESO-referred
                  </Text>
                </View>
                <Text style={styles.attnAction}>Review</Text>
                <Ionicons name="chevron-forward" size={18} color={amber.text} />
              </TouchableOpacity>
            ) : (
              <View style={styles.caughtUp} testID="attn-none">
                <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                <Text style={styles.caughtUpText}>All caught up. No applicants are waiting for review.</Text>
              </View>
            )}
          </>
        )}

        {unread > 0 && (
          <TouchableOpacity
            testID="unread-alerts"
            onPress={() => router.push('/(employer)/notifications')}
            style={styles.alertsRow}
            accessibilityRole="button"
          >
            <Ionicons name="notifications" size={18} color={Colors.primary} />
            <Text style={styles.alertsText}>{unread} new {unread === 1 ? 'alert' : 'alerts'}</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
          </TouchableOpacity>
        )}

        {!isPending && !isRejected && (
          <View style={styles.primaryActions}>
            <ActionTile
              testID="home-post-job"
              icon="add-circle-outline"
              label="Post New Job"
              primary
              onPress={() => router.push({ pathname: '/(employer)/job-form', params: { jobId: '' } })}
            />
            <ActionTile
              testID="home-my-jobs"
              icon="briefcase-outline"
              label="My Job Posts"
              onPress={() => router.push('/(employer)/manage-jobs')}
            />
          </View>
        )}

        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.statsRow}>
          <StatCard icon="briefcase-outline" label="Job Posts" value={jobs.length} />
          <StatCard icon="checkmark-done-outline" label="Active" value={activeJobs} />
          <StatCard icon="people-outline" label="Applicants" value={totalApplicants} />
        </View>

        <Text style={styles.sectionTitle}>Recent Job Posts</Text>
        {jobs.length === 0 ? (
          <EmptyState message="You haven't posted any jobs yet. Tap Post New Job to begin." />
        ) : (
          jobs.slice(0, 3).map((j) => (
            <TouchableOpacity
              key={j.id}
              testID={`emp-job-${j.id}`}
              onPress={() => router.push({ pathname: '/(employer)/applicants', params: { jobId: j.id, jobTitle: j.job_title } })}
              activeOpacity={0.85}
              style={styles.jobCard}
              accessibilityRole="button"
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.jobTitle}>{j.job_title}</Text>
                <View style={styles.jobMetaRow}>
                  <StatusBadge status={j.status === 'active' ? 'for_review' : 'closed'} label={j.status === 'active' ? 'Active' : 'Closed'} />
                  {(waitingByJob?.[j.id] || 0) > 0 && (
                    <Text style={styles.jobWaiting}>{waitingByJob?.[j.id]} waiting</Text>
                  )}
                </View>
              </View>
              <Text style={styles.manageLink}>Applicants ({j.applicant_count || 0})</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
            </TouchableOpacity>
          ))
        )}

        <Text style={styles.sectionTitle}>Company Profile</Text>
        <Card style={styles.companyCard} testID="company-profile-card">
          {!!profile?.business_type && <CompanyRow icon="business-outline" text={profile.business_type} />}
          {!!profile?.company_address && <CompanyRow icon="location-outline" text={profile.company_address} />}
          {!!profile?.contact_person && (
            <CompanyRow
              icon="call-outline"
              text={`${profile.contact_person}${profile.contact_number ? ` / ${profile.contact_number}` : ''}`}
            />
          )}
          <TouchableOpacity testID="edit-company-profile" onPress={openEdit} activeOpacity={0.75} style={styles.editButton} accessibilityRole="button">
            <Ionicons name="create-outline" size={16} color={Colors.primary} />
            <Text style={styles.editButtonText}>Edit Company Profile</Text>
          </TouchableOpacity>
        </Card>
      </View>

      <Modal visible={editing} transparent animationType="slide" onRequestClose={() => setEditing(false)}>
        <KeyboardAvoidingView style={styles.modalBg} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Company Profile</Text>
              <Text style={styles.modalSubtle}>These details appear on your job posts for job seekers.</Text>
              <Input testID="emp-company-name" label="Company Name *" value={form.company_name || ''} onChangeText={(v) => setField('company_name', v)} autoCapitalize="words" />
              <Input testID="emp-business-type" label="Business Type / Industry" value={form.business_type || ''} onChangeText={(v) => setField('business_type', v)} placeholder="e.g., Retail / Trading" autoCapitalize="words" />
              <Input testID="emp-address" label="Company Address" value={form.company_address || ''} onChangeText={(v) => setField('company_address', v)} placeholder="Street, Barangay, City/Municipality" multiline numberOfLines={2} autoCapitalize="words" />
              <Input testID="emp-contact-person" label="Contact Person" value={form.contact_person || ''} onChangeText={(v) => setField('contact_person', v)} autoCapitalize="words" />
              <Input testID="emp-contact-number" label="Contact Number" value={form.contact_number || ''} onChangeText={(v) => setField('contact_number', v)} keyboardType="phone-pad" />
              <Text style={styles.fieldLabel}>Company Size</Text>
              <View style={styles.sizeRow}>
                {['small', 'medium', 'large'].map((size) => (
                  <Chip
                    key={size}
                    testID={`emp-size-${size}`}
                    label={size.charAt(0).toUpperCase() + size.slice(1)}
                    active={form.company_size === size}
                    onPress={() => setField('company_size', size)}
                  />
                ))}
              </View>
              <Button testID="emp-save-profile" title="Save Profile" onPress={saveProfile} loading={saving} />
              <View style={{ height: Spacing.sm }} />
              <Button testID="emp-cancel-profile" title="Cancel" variant="secondary" onPress={() => setEditing(false)} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function StatCard({ label, value, icon }: { label: string; value: any; icon: IconName }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <View style={styles.statLabelRow}>
        <Ionicons name={icon} size={14} color={Colors.primary} style={{ marginRight: 4 }} />
        <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{label}</Text>
      </View>
    </View>
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

function CompanyRow({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.companyRow}>
      <Ionicons name={icon} size={16} color={Colors.gray} style={{ marginTop: 2 }} />
      <Text style={styles.companyRowText}>{text}</Text>
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
    paddingBottom: Spacing.lg,
  },
  kicker: { color: Colors.cardHighlight, fontSize: FontSize.xs, fontWeight: '900' },
  headerTitle: { color: Colors.white, fontSize: FontSize.xl, fontWeight: '900', marginTop: 4 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Colors.gray, fontSize: FontSize.xs, fontWeight: '800' },
  body: { padding: Spacing.md },
  companyCard: { marginBottom: Spacing.md, gap: Spacing.sm },
  companyRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  companyRowText: { flex: 1, color: Colors.textDark, fontSize: FontSize.sm, lineHeight: 20 },
  headerMetaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm, flexWrap: 'wrap' },
  headerEmail: { color: Colors.cardHighlight, fontSize: FontSize.sm, flexShrink: 1 },
  companyName: { color: Colors.white, fontSize: FontSize.xl, fontWeight: '900' },
  companyEmail: { color: Colors.cardHighlight, fontSize: FontSize.sm, marginTop: 5 },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.3)',
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  verifiedText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: '900' },
  companyMeta: { color: Colors.cardHighlight, fontSize: FontSize.sm, marginTop: 6, lineHeight: 19 },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderColor: Colors.primary,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 4,
  },
  editButtonText: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: '900' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    maxHeight: '90%',
    ...Shadow.raised,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '900', color: Colors.textDark },
  modalSubtle: { fontSize: FontSize.sm, color: Colors.gray, marginTop: 4, marginBottom: Spacing.md },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark, marginBottom: 6 },
  sizeRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: Spacing.md },
  warningCard: { backgroundColor: '#FEF3C7', borderColor: Colors.warning },
  warningTitle: { fontWeight: '900', color: '#92400E' },
  warningText: { color: '#92400E', marginTop: 4, fontSize: FontSize.sm, lineHeight: 20 },
  rejectedCard: { backgroundColor: '#FEE2E2', borderColor: Colors.error },
  rejectedTitle: { fontWeight: '900', color: '#991B1B' },
  rejectedText: { color: '#991B1B', marginTop: 4, fontSize: FontSize.sm },
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
  statLabelRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
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
  statLabel: { flexShrink: 1, fontSize: FontSize.xs, color: Colors.textDark, fontWeight: '800' },
  statValue: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.primary, fontVariant: ['tabular-nums'] },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: '900',
    color: Colors.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  attnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: amber.bg,
    borderColor: amber.border,
    borderWidth: 1,
    borderLeftWidth: 5,
    borderRadius: Radius.md,
    padding: 14,
    marginBottom: Spacing.md,
  },
  attnIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
    marginRight: Spacing.md,
  },
  attnTitle: { color: amber.text, fontSize: FontSize.md, fontWeight: '900' },
  attnDetail: { color: amber.text, fontSize: FontSize.xs, marginTop: 2, opacity: 0.85 },
  attnAction: { color: amber.text, fontSize: FontSize.sm, fontWeight: '900', marginLeft: Spacing.sm },
  caughtUp: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.cardHighlight, borderRadius: Radius.md, padding: 14, marginBottom: Spacing.md,
  },
  caughtUpText: { flex: 1, color: Colors.primaryDark, fontSize: FontSize.sm, fontWeight: '800' },
  alertsRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.cardHighlight, borderRadius: Radius.md,
    paddingVertical: 10, paddingHorizontal: 14, marginBottom: Spacing.md,
  },
  alertsText: { flex: 1, color: Colors.primaryDark, fontSize: FontSize.sm, fontWeight: '800' },
  actionList: { gap: Spacing.sm, marginBottom: Spacing.lg },
  actionBtn: {
    backgroundColor: Colors.white, borderColor: Colors.borderSoft, borderWidth: 1,
    borderRadius: Radius.md, minHeight: 52, paddingVertical: 14, paddingHorizontal: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  actionText: { color: Colors.textDark, fontSize: FontSize.md, fontWeight: '800' },
  actionArrow: { color: Colors.primary, fontSize: FontSize.lg, fontWeight: '900' },
  jobCard: {
    backgroundColor: Colors.white,
    borderColor: Colors.borderSoft,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadow.card,
  },
  jobTitle: { color: Colors.textDark, fontSize: FontSize.md, fontWeight: '900' },
  jobMetaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 6 },
  jobWaiting: { color: amber.text, fontSize: FontSize.xs, fontWeight: '900' },
  manageLink: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '900', marginRight: 2 },
});
