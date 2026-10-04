// ============================================================
// Admin: PESO Referral Requests (review, endorse, reject, close; monitor all records)
// Opening an undecided request records "For Review" automatically.
// ============================================================
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, Alert, ScrollView, Modal, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Card, StatusBadge, EmptyState, Input, Chip, Button, Row } from '../../src/components/ui';
import { NsrpProfileView, NsrpRequirements, Section } from '../../src/components/NsrpProfileView';
import { api, getApiError } from '../../src/api/client';
import { confirmAction } from '../../src/utils/confirm';
import {
  REFERRAL_STATUS_LABELS, OPEN_REFERRAL_STATUSES, currentStatus, describeHistory,
} from '../../src/utils/referral';
import { Colors, Spacing, FontSize, Radius, Shadow } from '../../src/constants/theme';

const FILTERS = [
  { key: 'open', label: 'Needs Action' },
  { key: 'peso_referred', label: 'PESO-Referred' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'closed', label: 'Closed' },
  { key: '', label: 'All' },
];

export default function ReferralRequests() {
  const [apps, setApps] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('open');
  const [detail, setDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await api.get('/admin/applications');
      setApps(res.data.applications || []);
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

  const openRequest = async (item: any) => {
    setDetail({ application: item });
    setNote('');
    setLoadingDetail(true);
    try {
      if (item.referral_status === 'submitted') {
        // PESO has opened the request: record "For Review" and notify the job seeker.
        await api.put(`/admin/applications/${item.id}/referral-status`, { referral_status: 'for_review' });
      }
      const res = await api.get(`/admin/applications/${item.id}`);
      setDetail(res.data);
      load();
    } catch (err) {
      Alert.alert('Error', getApiError(err));
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const decide = (next: 'peso_referred' | 'rejected' | 'closed') => {
    const app = detail?.application;
    if (!app) return;
    const reason = note.trim();
    if (next === 'rejected' && !reason) {
      Alert.alert('Reason Required', 'Type a reason so the job seeker knows what to fix before requesting again.');
      return;
    }
    const name = `${detail.profile?.first_name || app.first_name} ${detail.profile?.last_name || app.last_name}`;
    const copy = {
      peso_referred: ['Endorse as PESO-Referred', `Endorse ${name} to ${app.company_name} for "${app.job_title}"? The employer will be able to see this applicant.`, 'Endorse'],
      rejected: ['Reject Referral Request', `Reject ${name}'s referral request for "${app.job_title}"? They will see your reason and may request again.`, 'Reject'],
      closed: ['Close Referral Request', `Close ${name}'s referral request for "${app.job_title}" without a decision?`, 'Close Request'],
    }[next];
    confirmAction(copy[0], copy[1], async () => {
      setBusy(true);
      try {
        await api.put(`/admin/applications/${app.id}/referral-status`, { referral_status: next, notes: reason || null });
        setDetail(null);
        await load();
        Alert.alert('Saved', `Referral request marked ${REFERRAL_STATUS_LABELS[next]}. The job seeker has been notified.`);
      } catch (err) {
        Alert.alert('Error', getApiError(err));
      } finally {
        setBusy(false);
      }
    }, copy[2], next !== 'peso_referred');
  };

  const query = search.trim().toLowerCase();
  const visibleApps = apps.filter((a) => {
    if (filter === 'open' && !OPEN_REFERRAL_STATUSES.includes(a.referral_status)) return false;
    if (filter && filter !== 'open' && a.referral_status !== filter) return false;
    if (!query) return true;
    return [`${a.first_name} ${a.last_name}`, a.job_title, a.company_name, a.seeker_email]
      .some((v) => String(v || '').toLowerCase().includes(query));
  });
  const countFor = (key: string) => (key === 'open'
    ? apps.filter((a) => OPEN_REFERRAL_STATUSES.includes(a.referral_status)).length
    : key ? apps.filter((a) => a.referral_status === key).length : apps.length);

  const app = detail?.application;
  const isOpen = app && OPEN_REFERRAL_STATUSES.includes(app.referral_status);
  const match = detail?.skill_comparison;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.kicker}>PESO-Link MisOr</Text>
        <Text style={styles.headerTitle}>Referral Requests</Text>
        <Text style={styles.headerSub}>Review NSRP profiles and route endorsed applicants to employers</Text>
      </View>

      <View style={styles.filterCard}>
        <Input testID="app-search" value={search} onChangeText={setSearch} placeholder="Search applicant, job title, or company" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {FILTERS.map((f) => (
            <Chip
              key={f.key || 'all'}
              testID={`ref-filter-${f.key || 'all'}`}
              label={`${f.label} (${countFor(f.key)})`}
              active={filter === f.key}
              onPress={() => setFilter(f.key)}
            />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={visibleApps}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={<EmptyState message={apps.length ? 'No referral requests match this filter.' : 'No referral requests yet.'} />}
        renderItem={({ item }) => {
          const { status, stage } = currentStatus(item);
          const needsAction = OPEN_REFERRAL_STATUSES.includes(item.referral_status);
          return (
            <TouchableOpacity testID={`referral-${item.id}`} onPress={() => openRequest(item)} activeOpacity={0.85}>
              <Card style={needsAction ? { ...styles.appCard, ...styles.appCardOpen } : styles.appCard}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.applicant}>{item.first_name} {item.last_name}</Text>
                    <Text style={styles.company}>Referral for {item.job_title}</Text>
                    <Text style={styles.detail}>{item.company_name}{item.location ? ` / ${item.location}` : ''}</Text>
                    <Text style={styles.date}>Requested {new Date(item.applied_at).toLocaleDateString()}</Text>
                  </View>
                  <View style={styles.badgeStack}>
                    <StatusBadge status={status} />
                    <Text style={styles.stageText}>{stage === 'PESO' ? 'PESO review' : 'With employer'}</Text>
                  </View>
                </View>
                <Text style={styles.cardHint}>{needsAction ? 'Tap to review the NSRP profile and decide.' : 'Tap to view the referral record.'}</Text>
              </Card>
            </TouchableOpacity>
          );
        }}
      />

      <Modal visible={!!detail} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            {app && (
              <ScrollView keyboardShouldPersistTaps="handled">
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>
                      {[detail.profile?.first_name || app.first_name, detail.profile?.last_name || app.last_name].join(' ')}
                    </Text>
                    <Text style={styles.modalSubtle}>Referral for {app.job_title} / {app.company_name}</Text>
                  </View>
                  <StatusBadge status={currentStatus(app).status} />
                </View>

                {loadingDetail ? (
                  <ActivityIndicator color={Colors.primary} style={{ marginVertical: Spacing.xl }} />
                ) : (
                  <>
                    <Row left="Referral Status" right={REFERRAL_STATUS_LABELS[app.referral_status] || app.referral_status} />
                    {app.referral_status === 'peso_referred' && (
                      <Row left="Employer Status" right={currentStatus(app).status.replace('_', ' ')} style={{ textTransform: 'capitalize' }} />
                    )}
                    <Row left="Requested" right={new Date(app.applied_at).toLocaleString()} />
                    {!!app.referral_reviewed_at && (
                      <Row
                        left="Last PESO Action"
                        right={`${new Date(app.referral_reviewed_at).toLocaleDateString()}${app.referral_reviewed_by_email ? ` by ${app.referral_reviewed_by_email}` : ''}`}
                      />
                    )}
                    {!!app.referral_notes && <Row left="PESO Note" right={app.referral_notes} />}
                    {app.job_status === 'closed' && <Row left="Job Post" right="Closed" />}

                    {match && (
                      <Section title={`Skill Comparison (${match.matched_count}/${match.total_required_skills} matched)`}>
                        <Text style={styles.noticeText}>{match.skill_comparison_notice}</Text>
                        <SkillPills label="Matched" skills={match.matched_skills} matched />
                        <SkillPills label="Missing" skills={match.missing_required_skills} />
                      </Section>
                    )}

                    {!!app.cover_letter && (
                      <Section title="Cover Letter">
                        <Text style={styles.coverLetter}>{app.cover_letter}</Text>
                      </Section>
                    )}

                    <Section title="NSRP Profile">
                      <NsrpRequirements requirements={detail.referral_requirements} />
                    </Section>
                    {detail.profile && <NsrpProfileView profile={detail.profile} skills={detail.skills || []} />}

                    <Section title="Referral History">
                      {(detail.history || []).map((h: any) => (
                        <View key={h.id} style={styles.historyRow}>
                          <Text style={styles.historyStatus}>{describeHistory(h)}</Text>
                          <Text style={styles.historyMeta}>{new Date(h.changed_at).toLocaleString()}</Text>
                          {!!h.notes && <Text style={styles.historyNotes}>{h.notes}</Text>}
                        </View>
                      ))}
                    </Section>

                    {isOpen && (
                      <Section title="PESO Decision">
                        <Input
                          testID="referral-note"
                          label="Note to job seeker (required to reject)"
                          value={note}
                          onChangeText={setNote}
                          placeholder="e.g., Please add your barangay and preferred work location."
                          multiline
                          numberOfLines={3}
                          autoCapitalize="sentences"
                        />
                        <Button testID="referral-endorse" title="Endorse as PESO-Referred" onPress={() => decide('peso_referred')} loading={busy} />
                        <View style={{ height: Spacing.sm }} />
                        <Button testID="referral-reject" title="Reject Request" variant="danger" onPress={() => decide('rejected')} loading={busy} />
                        <View style={{ height: Spacing.sm }} />
                        <Button testID="referral-close" title="Close Request" variant="secondary" onPress={() => decide('closed')} loading={busy} />
                      </Section>
                    )}
                  </>
                )}

                <View style={{ marginTop: Spacing.md }}>
                  <Button testID="close-referral" title="Done" variant="secondary" onPress={() => setDetail(null)} />
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SkillPills({ label, skills, matched }: { label: string; skills: any[]; matched?: boolean }) {
  return (
    <View style={{ marginTop: Spacing.xs }}>
      <Text style={styles.pillLabel}>{label}</Text>
      {skills.length ? (
        <View style={styles.pillWrap}>
          {skills.map((s) => (
            <View key={s.id} style={[styles.skillPill, matched && styles.skillPillMatched]}>
              <Text style={[styles.skillText, matched && styles.skillTextMatched]}>{s.skill_name}</Text>
            </View>
          ))}
        </View>
      ) : <Text style={styles.noticeText}>None</Text>}
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
  appCard: { borderRadius: Radius.lg },
  appCardOpen: { borderColor: Colors.warning },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.sm },
  badgeStack: { alignItems: 'flex-end', gap: Spacing.xs },
  stageText: { fontSize: FontSize.xs, color: Colors.gray, fontWeight: '700' },
  applicant: { fontSize: FontSize.md, fontWeight: '900', color: Colors.textDark },
  company: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '800', marginTop: 3 },
  detail: { fontSize: FontSize.sm, color: Colors.gray, marginTop: 3 },
  date: { fontSize: FontSize.xs, color: Colors.gray, marginTop: 6 },
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
  noticeText: { fontSize: FontSize.xs, color: Colors.gray, lineHeight: 18 },
  pillLabel: { fontSize: FontSize.xs, fontWeight: '800', color: Colors.textDark, marginTop: 4 },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  skillPill: {
    backgroundColor: Colors.white, borderColor: Colors.borderSoft, borderWidth: 1,
    borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 5, marginRight: 6, marginBottom: 6,
  },
  skillPillMatched: { backgroundColor: Colors.cardHighlight, borderColor: Colors.primary },
  skillText: { color: Colors.textDark, fontSize: FontSize.xs, fontWeight: '700' },
  skillTextMatched: { color: Colors.primary, fontWeight: '800' },
  coverLetter: {
    fontSize: FontSize.sm, color: Colors.textDark, lineHeight: 20,
    backgroundColor: Colors.surface, padding: 10, borderRadius: Radius.sm,
  },
  historyRow: { paddingVertical: 6, borderBottomColor: Colors.borderSoft, borderBottomWidth: StyleSheet.hairlineWidth },
  historyStatus: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.textDark },
  historyMeta: { fontSize: FontSize.xs, color: Colors.gray, marginTop: 2 },
  historyNotes: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
});
