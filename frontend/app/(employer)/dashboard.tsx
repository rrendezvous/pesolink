// ============================================================
// Employer Dashboard
// ============================================================
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Card, EmptyState, Button, Input, Chip } from '../../src/components/ui';
import { api, getApiError } from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';
import { Colors, Spacing, FontSize, Radius, Shadow } from '../../src/constants/theme';

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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ ...styles.content, flexGrow: 1, paddingBottom: Spacing.xxl + 80 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      testID="employer-dashboard"
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>PESO-Link MisOr</Text>
          <Text style={styles.headerTitle}>Overview</Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.companyCard}>
          <Text style={styles.companyName}>{profile?.company_name || 'Employer'}</Text>
          <Text style={styles.companyEmail}>{user?.email}</Text>
          <View style={styles.verifiedPill}>
            <Text style={styles.verifiedText}>{profile?.approval_status === 'approved' ? 'Verified Partner' : 'PESO Managed Account'}</Text>
          </View>
          {!!profile?.business_type && <Text style={styles.companyMeta}>{profile.business_type}</Text>}
          {!!profile?.company_address && <Text style={styles.companyMeta}>{profile.company_address}</Text>}
          {!!profile?.contact_person && (
            <Text style={styles.companyMeta}>
              {profile.contact_person}{profile.contact_number ? ` / ${profile.contact_number}` : ''}
            </Text>
          )}
          <TouchableOpacity testID="edit-company-profile" onPress={openEdit} activeOpacity={0.75} style={styles.editButton}>
            <Text style={styles.editButtonText}>Edit Company Profile</Text>
          </TouchableOpacity>
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

        {/* Quick Actions removed: Manage and Post are available under Jobs tab in bottom navigation */}

        <Text style={styles.sectionTitle}>Recent Job Posts</Text>
        {jobs.length === 0 ? (
          <EmptyState message="You haven't posted any jobs yet." />
        ) : (
          jobs.slice(0, 3).map((j) => (
            <TouchableOpacity key={j.id} testID={`emp-job-${j.id}`} onPress={() => router.push({ pathname: '/(employer)/applicants', params: { jobId: j.id, jobTitle: j.job_title } })} activeOpacity={0.85} style={styles.jobCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.jobTitle}>{j.job_title}</Text>
                <Text style={styles.jobMeta}>{j.applicant_count || 0} PESO-referred / {j.status}</Text>
              </View>
              <Text style={styles.manageLink}>Manage</Text>
            </TouchableOpacity>
          ))
        )}
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
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadow.raised,
  },
  companyName: { color: Colors.white, fontSize: FontSize.xl, fontWeight: '900' },
  companyEmail: { color: Colors.cardHighlight, fontSize: FontSize.sm, marginTop: 5 },
  verifiedPill: {
    alignSelf: 'flex-start',
    borderColor: Colors.accent,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: Spacing.md,
  },
  verifiedText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: '900' },
  companyMeta: { color: Colors.cardHighlight, fontSize: FontSize.sm, marginTop: 6, lineHeight: 19 },
  editButton: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.white,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: Spacing.md,
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
  statCard: { flex: 1, backgroundColor: Colors.white, borderColor: Colors.borderSoft, borderWidth: 1, borderRadius: Radius.lg, padding: 14, ...Shadow.card },
  statLabel: { fontSize: FontSize.xs, color: Colors.gray, fontWeight: '900', textTransform: 'uppercase' },
  statValue: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.textDark, marginTop: 8 },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '900', color: Colors.textDark, marginTop: Spacing.sm, marginBottom: Spacing.sm },
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
  jobMeta: { color: Colors.gray, fontSize: FontSize.sm, marginTop: 4, textTransform: 'capitalize' },
  manageLink: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '900' },
});
