// ============================================================
// Admin: NSRP Verification (one-time PESO check of each job seeker's NSRP profile)
// Opening a submitted profile records "For Review" automatically. Verified job seekers apply to
// any job as PESO-Referred; a changed verified profile comes back here for re-checking.
// Also: deactivate / reactivate job seeker accounts.
// ============================================================
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Alert, RefreshControl, Modal, ScrollView, ActivityIndicator, TouchableOpacity, Image,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Card, Button, EmptyState, Row, Chip, StatusBadge, Input } from '../../src/components/ui';
import { NsrpProfileView, NsrpRequirements, Section } from '../../src/components/NsrpProfileView';
import { api, getApiError } from '../../src/api/client';
import { confirmAction } from '../../src/utils/confirm';
import { currentStatus, NSRP_STATUS_LABELS, NSRP_OPEN_STATUSES } from '../../src/utils/referral';
import { Colors, Spacing, FontSize, Radius, Shadow } from '../../src/constants/theme';

const FILTERS = [
  { key: 'open', label: 'Needs Action' },
  { key: 'verified', label: 'PESO-Verified' },
  { key: 'needs_revision', label: 'Needs Revision' },
  { key: 'not_submitted', label: 'Not Submitted' },
  { key: '', label: 'All' },
];

// NSRP Form 1 "For use of PESO only - Eligible for public employment services?"
const PESO_PROGRAMS = ['SPES', 'GIP', 'TUPAD', 'JobStart'];

const nameOf = (p: any) => [p?.first_name, p?.last_name].filter(Boolean).join(' ') || 'Job Seeker';

export default function NsrpVerification() {
  const [seekers, setSeekers] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [filter, setFilter] = useState('open');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [note, setNote] = useState('');
  const [deciding, setDeciding] = useState(false);
  const [programs, setPrograms] = useState<string[]>([]);
  const [programOther, setProgramOther] = useState('');
  const [forms, setForms] = useState<any[] | null>(null);
  const [formsLoading, setFormsLoading] = useState(false);

  const load = async () => {
    try {
      const res = await api.get('/admin/job-seekers');
      setSeekers(res.data.job_seekers || []);
    } catch (err) {
      console.warn(getApiError(err));
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const openProfile = async (seeker: any) => {
    setDetail({ profile: seeker });
    setNote('');
    setForms(null);
    setPrograms([]);
    setProgramOther('');
    setDetailLoading(true);
    try {
      if (seeker.nsrp_status === 'submitted') {
        // PESO has opened the profile: record "For Review" and notify the job seeker.
        await api.put(`/admin/job-seekers/${seeker.id}/nsrp-status`, { nsrp_status: 'for_review' });
      }
      const res = await api.get(`/admin/job-seekers/${seeker.id}/profile`);
      setDetail(res.data);
      load();
    } catch (err) {
      Alert.alert('Error', getApiError(err));
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // Uploaded NSRP form images are large, so they load only when PESO asks to compare.
  const loadForms = async () => {
    if (!detail?.profile) return;
    setFormsLoading(true);
    try {
      const res = await api.get(`/admin/job-seekers/${detail.profile.id}/nsrp-forms`);
      setForms(res.data.forms || []);
    } catch (err) {
      Alert.alert('Error', getApiError(err));
    } finally {
      setFormsLoading(false);
    }
  };

  const decide = (next: 'verified' | 'needs_revision') => {
    const profile = detail?.profile;
    if (!profile) return;
    const reason = note.trim();
    if (next === 'needs_revision' && !reason) {
      Alert.alert('Note Required', 'Tell the job seeker what to fix before they resubmit.');
      return;
    }
    const copy = next === 'verified'
      ? ['Verify NSRP Profile', `Verify ${nameOf(profile)}'s NSRP profile? They can then apply to any job as PESO-Referred until they change their profile.`, 'Verify']
      : ['Return for Revision', `Return ${nameOf(profile)}'s NSRP profile? They will see your note and can resubmit.`, 'Return'];
    confirmAction(copy[0], copy[1], async () => {
      setDeciding(true);
      try {
        await api.put(`/admin/job-seekers/${profile.id}/nsrp-status`, {
          nsrp_status: next,
          notes: reason || null,
          peso_assessment: next === 'verified' ? { programs, other: programOther } : undefined,
        });
        setDetail(null);
        await load();
        Alert.alert('Saved', `NSRP profile marked ${NSRP_STATUS_LABELS[next]}. The job seeker has been notified.`);
      } catch (err: any) {
        const missing = err?.response?.data?.missing_fields;
        Alert.alert('Error', Array.isArray(missing) && missing.length
          ? `${getApiError(err)}:\n\n${missing.join('\n')}`
          : getApiError(err));
      } finally {
        setDeciding(false);
      }
    }, copy[2], next !== 'verified');
  };

  const toggleStatus = (seeker: any) => {
    const isActive = seeker.account_status === 'active';
    const action = isActive ? 'deactivate' : 'reactivate';
    confirmAction(
      isActive ? 'Deactivate Account' : 'Reactivate Account',
      isActive
        ? `Deactivate "${nameOf(seeker)}"? Use this for incomplete, invalid, or inappropriate information. They will not be able to sign in.`
        : `Reactivate "${nameOf(seeker)}"?`,
      async () => {
        setBusyId(seeker.id);
        try {
          await api.put(`/admin/job-seekers/${seeker.id}/${action}`);
          setDetail(null);
          await load();
        } catch (err) {
          Alert.alert('Error', getApiError(err));
        } finally {
          setBusyId(null);
        }
      },
      isActive ? 'Deactivate' : 'Reactivate',
      isActive,
    );
  };

  const query = search.trim().toLowerCase();
  const matchesFilter = (s: any, key: string) => {
    if (key === 'open') return NSRP_OPEN_STATUSES.includes(s.nsrp_status);
    return key ? s.nsrp_status === key : true;
  };
  const visibleSeekers = seekers.filter((s) => {
    if (!matchesFilter(s, filter)) return false;
    if (!query) return true;
    return [nameOf(s), s.email, s.city].some((v) => String(v || '').toLowerCase().includes(query));
  });

  const profile = detail?.profile;
  const canDecide = profile && NSRP_OPEN_STATUSES.includes(profile.nsrp_status);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.kicker}>PESO-Link MisOr</Text>
        <Text style={styles.headerTitle}>NSRP Verification</Text>
        <Text style={styles.headerSub}>Verify each job seeker&apos;s NSRP profile once; changed profiles come back here</Text>
      </View>

      <View style={styles.filterCard}>
        <Input testID="seeker-search" value={search} onChangeText={setSearch} placeholder="Search name, email, or city" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {FILTERS.map((f) => (
            <Chip
              key={f.key || 'all'}
              testID={`seeker-filter-${f.key || 'all'}`}
              label={`${f.label} (${seekers.filter((s) => matchesFilter(s, f.key)).length})`}
              active={filter === f.key}
              onPress={() => setFilter(f.key)}
            />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={visibleSeekers}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={<EmptyState message={seekers.length ? 'No job seekers match this filter.' : 'No job seekers registered yet.'} />}
        renderItem={({ item }) => {
          const isActive = item.account_status === 'active';
          const needsAction = NSRP_OPEN_STATUSES.includes(item.nsrp_status);
          return (
            <Card testID={`seeker-${item.id}`} style={needsAction ? { ...styles.seekerCard, ...styles.seekerCardOpen } : styles.seekerCard}>
              <TouchableOpacity onPress={() => openProfile(item)} activeOpacity={0.85}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{nameOf(item)}</Text>
                    <Text style={styles.subtitle}>{item.email}</Text>
                  </View>
                  <StatusBadge status={item.nsrp_status || 'not_submitted'} />
                </View>
                <View style={{ marginTop: Spacing.sm }}>
                  <Row left="Location" right={`${item.city || ''} ${item.province || ''}`.trim() || 'N/A'} />
                  <Row left="Required Items" right={item.profile_completed ? 'Complete' : 'Incomplete'} />
                  {!!item.nsrp_submitted_at && needsAction && (
                    <Row left="Submitted" right={new Date(item.nsrp_submitted_at).toLocaleDateString()} />
                  )}
                  <Row left="Account" right={String(item.account_status).toUpperCase()} />
                </View>
                <Text style={styles.cardHint}>
                  {needsAction ? 'Tap to check the NSRP profile and decide.' : 'Tap to view the NSRP profile.'}
                </Text>
              </TouchableOpacity>
              <View style={{ marginTop: Spacing.sm }}>
                <Button
                  testID={`toggle-${item.id}`}
                  title={isActive ? 'Deactivate Account' : 'Reactivate Account'}
                  variant={isActive ? 'danger' : 'secondary'}
                  onPress={() => toggleStatus(item)}
                  loading={busyId === item.id}
                />
              </View>
            </Card>
          );
        }}
      />

      <Modal visible={!!detail} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            {profile && (
              <ScrollView keyboardShouldPersistTaps="handled">
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>
                      {[profile.first_name, profile.middle_name, profile.last_name, profile.nsrp_full_data?.suffix]
                        .filter(Boolean).join(' ') || 'Job Seeker'}
                    </Text>
                    <Text style={styles.modalSubtle}>{profile.email}</Text>
                  </View>
                  <StatusBadge status={profile.nsrp_status || 'not_submitted'} />
                </View>

                {detailLoading ? (
                  <ActivityIndicator color={Colors.primary} style={{ marginVertical: Spacing.xl }} />
                ) : (
                  <>
                    <Row left="NSRP Status" right={NSRP_STATUS_LABELS[profile.nsrp_status] || profile.nsrp_status} />
                    {!!profile.nsrp_submitted_at && (
                      <Row left="Submitted" right={new Date(profile.nsrp_submitted_at).toLocaleString()} />
                    )}
                    {!!profile.nsrp_reviewed_at && (
                      <Row
                        left="Last PESO Action"
                        right={`${new Date(profile.nsrp_reviewed_at).toLocaleDateString()}${profile.nsrp_reviewed_by_email ? ` by ${profile.nsrp_reviewed_by_email}` : ''}`}
                      />
                    )}
                    {!!profile.nsrp_review_notes && <Row left="PESO Note" right={profile.nsrp_review_notes} />}
                    <Row
                      left="Certification"
                      right={profile.nsrp_certified_at ? `Accepted ${new Date(profile.nsrp_certified_at).toLocaleDateString()}` : 'Not yet accepted'}
                    />
                    {!!profile.peso_assessment && (
                      <Row
                        left="Eligible for (PESO)"
                        right={[...(profile.peso_assessment.programs || []), profile.peso_assessment.other].filter(Boolean).join(', ') || 'None marked'}
                      />
                    )}

                    <Section title="Uploaded NSRP Form">
                      {!detail.uploaded_form_count ? (
                        <Text style={styles.emptyText}>No NSRP form image uploaded. This profile was encoded manually.</Text>
                      ) : forms === null ? (
                        <Button
                          testID="show-nsrp-forms"
                          title={`Show Uploaded Form (${detail.uploaded_form_count})`}
                          variant="secondary"
                          onPress={loadForms}
                          loading={formsLoading}
                        />
                      ) : (
                        forms.map((f: any) => (
                          <View key={f.id} style={styles.formImageWrap}>
                            <Image source={{ uri: f.image_base64 }} style={styles.formImage} resizeMode="contain" />
                            <Text style={styles.appMeta}>
                              Uploaded {new Date(f.uploaded_at).toLocaleString()} / {f.ocr_confirmed ? 'OCR result confirmed by job seeker' : 'OCR result not confirmed'}
                            </Text>
                          </View>
                        ))
                      )}
                    </Section>

                    <Section title="Required NSRP Items">
                      <NsrpRequirements requirements={detail.referral_requirements} />
                    </Section>
                    <NsrpProfileView profile={profile} skills={detail.skills || []} />

                    <Section title={`Applications (${(detail.applications || []).length})`}>
                      {(detail.applications || []).length ? detail.applications.map((a: any) => (
                        <View key={a.id} style={styles.appRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.appTitle}>{a.job_title}</Text>
                            <Text style={styles.appMeta}>{a.company_name} / {new Date(a.applied_at).toLocaleDateString()}</Text>
                          </View>
                          <StatusBadge status={currentStatus(a).status} />
                        </View>
                      )) : <Text style={styles.emptyText}>No applications yet.</Text>}
                    </Section>

                    {canDecide && (
                      <Section title="PESO Decision">
                        <Input
                          testID="nsrp-note"
                          label="Note to job seeker (required to return)"
                          value={note}
                          onChangeText={setNote}
                          placeholder="e.g., Please add your barangay and SSS number."
                          multiline
                          numberOfLines={3}
                          autoCapitalize="sentences"
                        />
                        <Text style={styles.assessLabel}>For use of PESO only - eligible for public employment services? (optional, saved on Verify)</Text>
                        <View style={styles.programRow}>
                          {PESO_PROGRAMS.map((prog) => (
                            <Chip
                              key={prog}
                              testID={`program-${prog}`}
                              label={prog}
                              active={programs.includes(prog)}
                              onPress={() => setPrograms((cur) => (cur.includes(prog) ? cur.filter((x) => x !== prog) : [...cur, prog]))}
                            />
                          ))}
                        </View>
                        <Input testID="program-other" label="Others, specify" value={programOther} onChangeText={setProgramOther} />
                        <Button testID="nsrp-verify" title="Verify NSRP Profile" onPress={() => decide('verified')} loading={deciding} />
                        <View style={{ height: Spacing.sm }} />
                        <Button testID="nsrp-return" title="Return for Revision" variant="danger" onPress={() => decide('needs_revision')} loading={deciding} />
                      </Section>
                    )}
                  </>
                )}

                <View style={{ marginTop: Spacing.md }}>
                  <Button testID="close-profile" title="Done" variant="secondary" onPress={() => setDetail(null)} />
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.lightBg },
  header: {
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  kicker: { color: Colors.cardHighlight, fontSize: FontSize.xs, fontWeight: '900' },
  headerTitle: { color: Colors.white, fontSize: FontSize.xl, fontWeight: '900', marginTop: 4 },
  headerSub: { color: Colors.cardHighlight, fontSize: FontSize.sm, marginTop: 4 },
  filterCard: {
    backgroundColor: Colors.white,
    borderColor: Colors.borderSoft,
    borderWidth: 1,
    borderRadius: Radius.lg,
    margin: Spacing.md,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    paddingBottom: Spacing.sm,
    ...Shadow.card,
  },
  listContent: { padding: Spacing.md, paddingTop: Spacing.xs, paddingBottom: Spacing.xl },
  seekerCard: { borderRadius: Radius.lg },
  seekerCardOpen: { borderColor: Colors.warning },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  name: { fontSize: FontSize.lg, fontWeight: '900', color: Colors.textDark },
  subtitle: { fontSize: FontSize.sm, color: Colors.primary, marginTop: 2 },
  cardHint: { fontSize: FontSize.xs, color: Colors.gray, marginTop: Spacing.sm },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    maxHeight: '92%',
    ...Shadow.raised,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.sm },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '900', color: Colors.textDark },
  modalSubtle: { fontSize: FontSize.sm, color: Colors.gray, marginTop: 2 },
  appRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: 8, borderBottomColor: Colors.borderSoft, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  appTitle: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.textDark },
  appMeta: { fontSize: FontSize.xs, color: Colors.gray, marginTop: 2 },
  emptyText: { color: Colors.gray, fontSize: FontSize.xs },
  assessLabel: { fontSize: FontSize.xs, color: Colors.textDark, fontWeight: '700', marginBottom: 6 },
  programRow: { flexDirection: 'row', flexWrap: 'wrap' },
  formImageWrap: { marginBottom: Spacing.sm },
  formImage: {
    width: '100%', aspectRatio: 0.72, backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.borderSoft,
  },
});
