// ============================================================
// Admin: Referrals (monitor PESO-referred applications across all job posts)
// "By Job" shows each job post with its applicant counts per status; tapping one lists its applicants.
// PESO's decision happens once per job seeker on the NSRP Verification screen.
// ============================================================
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, Alert, ScrollView, Modal, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Card, StatusBadge, EmptyState, Input, Chip, Button, Row } from '../../src/components/ui';
import { NsrpProfileView, NsrpRequirements, Section } from '../../src/components/NsrpProfileView';
import { api, getApiError } from '../../src/api/client';
import { REFERRAL_STATUS_LABELS, currentStatus, describeHistory } from '../../src/utils/referral';
import { Colors, Spacing, FontSize, Radius, Shadow } from '../../src/constants/theme';

// Filtered by where the application stands now (employer status, or the referral record if not referred).
const FILTERS = [
  { key: '', label: 'All' },
  { key: 'for_review', label: 'For Review' },
  { key: 'for_interview', label: 'For Interview' },
  { key: 'hired', label: 'Hired' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'closed', label: 'Closed' },
];

export default function MonitorApplications() {
  const [apps, setApps] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [view, setView] = useState<'jobs' | 'applicants'>('jobs');
  const [employerFilter, setEmployerFilter] = useState<number | null>(null);
  const [jobFilter, setJobFilter] = useState<any | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [detail, setDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = async () => {
    try {
      const [a, j] = await Promise.all([api.get('/admin/applications'), api.get('/admin/jobs')]);
      setApps(a.data.applications || []);
      setJobs(j.data.jobs || []);
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
    setLoadingDetail(true);
    try {
      const res = await api.get(`/admin/applications/${item.id}`);
      setDetail(res.data);
    } catch (err) {
      Alert.alert('Error', getApiError(err));
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const query = search.trim().toLowerCase();
  const employers = Array.from(new Map(jobs.map((j) => [j.employer_id, j.company_name])).entries());
  const matchesQuery = (values: any[]) => !query || values.some((v) => String(v || '').toLowerCase().includes(query));

  const scopedApps = apps.filter((a) => (!employerFilter || a.employer_id === employerFilter)
    && (!jobFilter || a.job_post_id === jobFilter.id));
  const visibleApps = scopedApps.filter((a) => (!filter || currentStatus(a).status === filter)
    && matchesQuery([`${a.first_name} ${a.last_name}`, a.job_title, a.company_name, a.seeker_email]));
  const countFor = (key: string) => (key ? scopedApps.filter((a) => currentStatus(a).status === key).length : scopedApps.length);

  const visibleJobs = jobs.filter((j) => (!employerFilter || j.employer_id === employerFilter)
    && matchesQuery([j.job_title, j.company_name, j.location]));
  const statusCounts = (jobId: number) => {
    const counts: Record<string, number> = {};
    for (const a of apps.filter((x) => x.job_post_id === jobId)) {
      const st = currentStatus(a).status;
      counts[st] = (counts[st] || 0) + 1;
    }
    return counts;
  };
  const openJob = (job: any) => { setJobFilter(job); setFilter(''); setView('applicants'); };

  const app = detail?.application;
  const match = detail?.skill_comparison;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.kicker}>PESO-Link MisOr</Text>
        <Text style={styles.headerTitle}>PESO-Referred Applications</Text>
        <Text style={styles.headerSub}>Monitor PESO-referred applications and employer status updates</Text>
      </View>

      <View style={styles.filterCard}>
        <View style={styles.viewSwitch}>
          {(['jobs', 'applicants'] as const).map((v) => (
            <TouchableOpacity
              key={v}
              testID={`view-${v}`}
              onPress={() => { setView(v); if (v === 'jobs') setJobFilter(null); }}
              style={[styles.viewTab, view === v && styles.viewTabActive]}
            >
              <Text style={[styles.viewTabText, view === v && styles.viewTabTextActive]}>
                {v === 'jobs' ? `By Job (${jobs.length})` : `All Applicants (${apps.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Input
          testID="app-search"
          value={search}
          onChangeText={setSearch}
          placeholder={view === 'jobs' ? 'Search job title, company, or location' : 'Search applicant, job title, or company'}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Chip label="All Employers" active={!employerFilter} onPress={() => setEmployerFilter(null)} />
          {employers.map(([id, name]) => (
            <Chip key={id} testID={`emp-chip-${id}`} label={String(name)} active={employerFilter === id} onPress={() => setEmployerFilter(id)} />
          ))}
        </ScrollView>
        {view === 'applicants' && (
          <>
            {jobFilter && (
              <TouchableOpacity onPress={() => setJobFilter(null)} style={styles.jobFilterBar}>
                <Text style={styles.jobFilterText} numberOfLines={1}>Job: {jobFilter.job_title} / {jobFilter.company_name}</Text>
                <Text style={styles.jobFilterClear}>Clear</Text>
              </TouchableOpacity>
            )}
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
          </>
        )}
      </View>

      {view === 'jobs' ? (
        <FlatList
          data={visibleJobs}
          keyExtractor={(item) => `job-${item.id}`}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={<EmptyState message={jobs.length ? 'No job posts match this filter.' : 'No job posts yet.'} />}
          renderItem={({ item }) => {
            const counts = statusCounts(item.id);
            const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
            return (
              <TouchableOpacity testID={`job-group-${item.id}`} onPress={() => openJob(item)} activeOpacity={0.85}>
                <Card style={styles.appCard}>
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.applicant}>{item.job_title}</Text>
                      <Text style={styles.company}>{item.company_name}</Text>
                      <Text style={styles.detail}>
                        {item.location || 'No location'} / {item.vacancies} {item.vacancies === 1 ? 'vacancy' : 'vacancies'}
                      </Text>
                    </View>
                    <StatusBadge status={item.status === 'active' ? 'for_review' : 'closed'} label={item.status === 'active' ? 'Open' : 'Closed'} />
                  </View>
                  <View style={styles.countRow}>
                    {total === 0 ? (
                      <Text style={styles.cardHint}>No PESO-referred applicants yet.</Text>
                    ) : FILTERS.filter((f) => f.key && counts[f.key]).map((f) => (
                      <View key={f.key} style={styles.countPill}>
                        <Text style={styles.countValue}>{counts[f.key]}</Text>
                        <Text style={styles.countLabel}>{f.label}</Text>
                      </View>
                    ))}
                  </View>
                  {total > 0 && <Text style={styles.cardHint}>Tap to see the {total} applicant{total === 1 ? '' : 's'}.</Text>}
                </Card>
              </TouchableOpacity>
            );
          }}
        />
      ) : (
      <FlatList
        data={visibleApps}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={<EmptyState message={apps.length ? 'No applications match this filter.' : 'No applications yet.'} />}
        renderItem={({ item }) => {
          const { status, stage } = currentStatus(item);
          return (
            <TouchableOpacity testID={`referral-${item.id}`} onPress={() => openRequest(item)} activeOpacity={0.85}>
              <Card style={styles.appCard}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.applicant}>{item.first_name} {item.last_name}</Text>
                    <Text style={styles.company}>{item.job_title}</Text>
                    <Text style={styles.detail}>{item.company_name}{item.location ? ` / ${item.location}` : ''}</Text>
                    <Text style={styles.date}>Applied {new Date(item.applied_at).toLocaleDateString()}</Text>
                  </View>
                  <View style={styles.badgeStack}>
                    <StatusBadge status={status} />
                    <Text style={styles.stageText}>{stage === 'PESO' ? 'Referral record' : 'With employer'}</Text>
                  </View>
                </View>
                <Text style={styles.cardHint}>Tap to view the application and NSRP profile.</Text>
              </Card>
            </TouchableOpacity>
          );
        }}
      />
      )}

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
                    <Text style={styles.modalSubtle}>{app.job_title} / {app.company_name}</Text>
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
                    <Row left="Applied" right={new Date(app.applied_at).toLocaleString()} />
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

                    <Section title="Status History">
                      {(detail.history || []).map((h: any) => (
                        <View key={h.id} style={styles.historyRow}>
                          <Text style={styles.historyStatus}>{describeHistory(h)}</Text>
                          <Text style={styles.historyMeta}>{new Date(h.changed_at).toLocaleString()}</Text>
                          {!!h.notes && <Text style={styles.historyNotes}>{h.notes}</Text>}
                        </View>
                      ))}
                    </Section>

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
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.sm },
  badgeStack: { alignItems: 'flex-end', gap: Spacing.xs },
  stageText: { fontSize: FontSize.xs, color: Colors.gray, fontWeight: '700' },
  applicant: { fontSize: FontSize.md, fontWeight: '900', color: Colors.textDark },
  company: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '800', marginTop: 3 },
  detail: { fontSize: FontSize.sm, color: Colors.gray, marginTop: 3 },
  date: { fontSize: FontSize.xs, color: Colors.gray, marginTop: 6 },
  cardHint: { fontSize: FontSize.xs, color: Colors.gray, marginTop: Spacing.sm },
  viewSwitch: {
    flexDirection: 'row', backgroundColor: Colors.muted, borderRadius: Radius.md, padding: 4, marginBottom: Spacing.sm,
  },
  viewTab: { flex: 1, paddingVertical: 8, borderRadius: Radius.sm, alignItems: 'center' },
  viewTabActive: { backgroundColor: Colors.white, ...Shadow.card },
  viewTabText: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.gray },
  viewTabTextActive: { color: Colors.primaryDark },
  jobFilterBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.cardHighlight,
    borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 8, marginBottom: Spacing.sm,
  },
  jobFilterText: { flex: 1, fontSize: FontSize.sm, fontWeight: '800', color: Colors.primaryDark },
  jobFilterClear: { fontSize: FontSize.sm, fontWeight: '900', color: Colors.primary },
  countRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  countPill: {
    flexDirection: 'row', alignItems: 'baseline', gap: 4, backgroundColor: Colors.muted,
    borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4,
  },
  countValue: { fontSize: FontSize.sm, fontWeight: '900', color: Colors.textDark },
  countLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.gray },
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
