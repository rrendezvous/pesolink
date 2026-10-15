// ============================================================
// PESO-Referred Applicants + Status Update (combined)
// Only PESO-referred applicants appear here: job seekers whose NSRP profile PESO Admin verified.
// ============================================================
import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Alert, Modal, TouchableOpacity, ScrollView, RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import { Card, Button, StatusBadge, EmptyState, Row, Chip } from '../../src/components/ui';
import { api, getApiError } from '../../src/api/client';
import { jobState, JOB_STATE_LABELS } from '../../src/utils/jobs';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, Radius, Shadow, StatusLabels, StatusColors } from '../../src/constants/theme';

const amber = StatusColors.needs_revision;

const STATUSES = ['for_review', 'for_interview', 'hired', 'rejected'] as const;
// Filter chips also include Closed (job closed or seeker deactivated).
const FILTERS = ['for_review', 'for_interview', 'hired', 'rejected', 'closed'] as const;

export default function Applicants() {
  const router = useRouter();
  const { jobId, jobTitle } = useLocalSearchParams<{ jobId: string; jobTitle: string }>();
  // Applicants and job details are kept with the job they belong to, so switching jobs never shows the previous job's data.
  const [jobData, setJobData] = useState<{ jobId?: string; applicants: any[]; job: any }>({ applicants: [], job: null });
  const isCurrent = !!jobId && jobData.jobId === jobId;
  const applicants = isCurrent ? jobData.applicants : [];
  const jobInfo = isCurrent ? jobData.job : null;
  const [jobs, setJobs] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [updating, setUpdating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // The filter belongs to one job post; opening another job shows every applicant again.
  const [filter, setFilter] = useState<{ jobId?: string; status: string }>({ status: '' });
  const statusFilter = filter.jobId === jobId ? filter.status : '';
  const setStatusFilter = (status: string) => setFilter({ jobId, status });

  // Opened from the tab bar there is no job selected yet: list the job posts to choose from.
  // Only the newest request may update the screen: when the employer switches jobs quickly, a slower reply
  // for the previous job must not replace the current job's applicants (it would show an empty list).
  const latestRequest = useRef(0);
  // Until the first reply for a list arrives, the screen says Loading (or shows the error), never "no applicants".
  const [jobsLoaded, setJobsLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState<{ key: string; message: string } | null>(null);
  // What is on screen right now, for load() (the focus callback keeps the load() of an earlier render,
  // whose state values would be out of date).
  const loadedJobRef = useRef<string | undefined>(undefined);
  const jobsLoadedRef = useRef(false);
  const listKey = jobId || 'jobs';
  const load = async () => {
    const request = ++latestRequest.current;
    const key = listKey;
    try {
      if (!jobId) {
        const res = await api.get('/employer/jobs');
        if (request !== latestRequest.current) return;
        setJobs(res.data.jobs || []);
        setJobsLoaded(true);
        jobsLoadedRef.current = true;
        setLoadFailed(null);
        return;
      }
      const res = await api.get(`/employer/jobs/${jobId}/applicants`);
      if (request !== latestRequest.current) return;
      const fresh: any[] = res.data.applicants || [];
      setJobData({ jobId, applicants: fresh, job: res.data.job || null });
      loadedJobRef.current = jobId;
      // An open details window shows the fresh record (e.g. the applicant changed the profile after verification).
      setSelected((prev: any) => (prev ? fresh.find((a) => a.application_id === prev.application_id) || prev : prev));
      setLoadFailed(null);
    } catch (err) {
      if (request !== latestRequest.current) return;
      const hasData = jobId ? loadedJobRef.current === jobId : jobsLoadedRef.current;
      // With a list already on screen a failed refresh keeps it and says so; without one, the error replaces "Loading".
      if (hasData) Alert.alert('Error', getApiError(err));
      else setLoadFailed({ key, message: getApiError(err) });
    }
  };

  const loadingOrError = loadFailed?.key === listKey ? (
    <Card style={styles.applicantCard}>
      <Text style={styles.name}>Could not load this list</Text>
      <Text testID="applicants-load-error" style={styles.detail}>Check the connection and try again. ({loadFailed.message})</Text>
      <Button testID="applicants-retry" title="Try Again" variant="secondary" style={{ marginTop: Spacing.sm }} onPress={load} />
    </Card>
  ) : (
    <EmptyState message="Loading..." />
  );

  useFocusEffect(useCallback(() => { load(); }, [jobId]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  // Show the record right away, then reload so the details are not older than the applicant's current profile.
  const openApplicant = (item: any) => { setSelected(item); load(); };


  const countFor = (status: string) => applicants.filter((a) => a.application_status === status).length;

  const stopAccepting = () => {
    if (!jobInfo) return;
    Alert.alert(
      `Close "${jobInfo.job_title}"?`,
      'This job post will stop accepting applications and will no longer appear in the job list.\n\n'
        + 'Applicants still in progress will be marked Closed and notified. This is not a rejection. '
        + 'Hired applicants stay Hired.\n\nThe record stays available for PESO monitoring.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close Job Post',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.put(`/employer/jobs/${jobInfo.id}/close`);
              await load();
            } catch (err) {
              Alert.alert('Error', getApiError(err));
            }
          },
        },
      ],
    );
  };
  const visibleApplicants = statusFilter ? applicants.filter((a) => a.application_status === statusFilter) : applicants;

  const vacancies = Number(jobInfo?.vacancies) || 0;
  const hiredCount = countFor('hired');
  const jobClosed = jobInfo?.status === 'closed';
  const vacanciesFilled = vacancies > 0 && hiredCount >= vacancies;
  const otherOpen = applicants.filter((a) => ['for_review', 'for_interview'].includes(a.application_status)).length;

  // What the employer can do with the other applicants once the job is filled. Nothing happens to them automatically.
  const OTHER_APPLICANT_CHOICES =
    'Your other applicants are not changed. You can keep them for future openings, update each one\'s status, '
    + 'or stop accepting applications for this job post.';

  // Hired and Rejected notify the job seeker, so confirm them first and say what does and does not change.
  const requestStatus = (newStatus: string) => {
    if (!selected) return;
    const name = `${selected.first_name || ''} ${selected.last_name || ''}`.trim() || 'this applicant';
    if (newStatus === 'hired') {
      Alert.alert(
        `Mark ${name} as Hired?`,
        `${name} will be notified that they are hired.\n\n` + OTHER_APPLICANT_CHOICES,
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Mark as Hired', onPress: () => updateStatus(newStatus) }],
      );
    } else if (newStatus === 'rejected') {
      Alert.alert(
        `Mark ${name} as Rejected?`,
        `${name} will be notified that they are no longer being considered for this job.`,
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Mark as Rejected', style: 'destructive', onPress: () => updateStatus(newStatus) }],
      );
    } else {
      updateStatus(newStatus);
    }
  };

  const updateStatus = async (newStatus: string) => {
    if (!selected || updating) return;
    setUpdating(true);
    try {
      await api.put(`/employer/applications/${selected.application_id}/status`, { status: newStatus });
      const newHired = hiredCount + (newStatus === 'hired' && selected.application_status !== 'hired' ? 1 : 0);
      if (newStatus === 'hired' && vacancies > 0 && newHired >= vacancies && !jobClosed) {
        Alert.alert(
          'All Vacancies Filled',
          `${newHired} hired for ${vacancies} ${vacancies === 1 ? 'vacancy' : 'vacancies'}.\n\n` + OTHER_APPLICANT_CHOICES,
        );
      } else {
        Alert.alert('Status Updated', `Applicant status set to "${StatusLabels[newStatus as keyof typeof StatusLabels]}".`);
      }
      setSelected(null);
      await load();
    } catch (err) {
      Alert.alert('Error', getApiError(err));
    } finally {
      setUpdating(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.kicker}>PESO-Link MisOr</Text>
        <Text style={styles.headerTitle}>PESO-Referred Applicants</Text>
        <Text style={styles.headerSub}>{jobId ? (jobTitle || 'Selected job post') : 'Choose a job post to see its applicants'}</Text>
        {!!jobId && (
          <TouchableOpacity
            testID="choose-job"
            onPress={() => router.setParams({ jobId: '', jobTitle: '' })}
            activeOpacity={0.75}
            style={styles.chooseJob}
          >
            <Text style={styles.chooseJobText}>{'< Choose another job post'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {!jobId ? (
        <FlatList
          data={jobs}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={jobsLoaded ? <EmptyState message="No job posts yet. Post a job under Jobs." /> : loadingOrError}
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={`pick-job-${item.id}`}
              onPress={() => router.setParams({ jobId: String(item.id), jobTitle: item.job_title })}
              activeOpacity={0.82}
            >
              <Card style={styles.applicantCard}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.job_title}</Text>
                    <Text style={styles.detail}>{item.location}</Text>
                  </View>
                  <StatusBadge status={jobState(item) === 'active' ? 'for_review' : jobState(item) === 'expired' ? 'needs_revision' : 'closed'} label={jobState(item) === 'active' ? 'Open' : JOB_STATE_LABELS[jobState(item)]} />
                </View>
                <Text style={styles.cardHint}>
                  {item.applicant_count || 0} PESO-referred applicant{Number(item.applicant_count) === 1 ? '' : 's'}. Tap to view.
                </Text>
              </Card>
            </TouchableOpacity>
          )}
        />
      ) : (
      <FlatList
        data={visibleApplicants}
        keyExtractor={(item) => String(item.application_id)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListHeaderComponent={
          <View>
            {!!jobInfo && vacancies > 0 && (
              <View style={[styles.vacancyCard, vacanciesFilled && styles.vacancyCardFilled]} testID="vacancy-card">
                <View style={styles.vacancyHead}>
                  <Text style={styles.vacancyTitle}>
                    {jobClosed ? 'Job post closed' : vacanciesFilled ? 'All vacancies filled' : 'Vacancies'}
                  </Text>
                  <Text style={styles.vacancyCount}>{Math.min(hiredCount, vacancies)} of {vacancies} filled</Text>
                </View>
                <View style={styles.vacancyTrack}>
                  <View style={[styles.vacancyFill, { width: `${Math.min(100, Math.round((hiredCount / vacancies) * 100))}%` }]} />
                </View>
                {vacanciesFilled && !jobClosed && (
                  <>
                    <Text style={styles.vacancyText}>
                      {otherOpen > 0
                        ? `${otherOpen} other ${otherOpen === 1 ? 'applicant is' : 'applicants are'} still in progress. ${OTHER_APPLICANT_CHOICES}`
                        : 'No other applicants are in progress.'}
                    </Text>
                    <TouchableOpacity testID="vacancy-stop" onPress={stopAccepting} style={styles.vacancyLink} accessibilityRole="button">
                      <Ionicons name="lock-closed-outline" size={14} color={Colors.gray} />
                      <Text style={styles.vacancyLinkText}>
                        {jobState(jobInfo) === 'expired' ? 'Close job post' : 'Stop accepting applications'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
                {jobClosed && (
                  <Text style={styles.vacancyText}>This job post no longer accepts applications. Applicants still in progress were marked Closed (not a rejection).</Text>
                )}
              </View>
            )}
            {applicants.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            <Chip testID="app-filter-all" label={`All (${applicants.length})`} active={!statusFilter} onPress={() => setStatusFilter('')} />
            {FILTERS.map((f) => (
              <Chip
                key={f}
                testID={`app-filter-${f}`}
                label={`${StatusLabels[f]} (${countFor(f)})`}
                active={statusFilter === f}
                onPress={() => setStatusFilter(statusFilter === f ? '' : f)}
              />
            ))}
          </ScrollView>
            )}
          </View>
        }
        ListEmptyComponent={!isCurrent ? loadingOrError : (
          <EmptyState
            message={applicants.length > 0
              ? 'No applicants with this status.'
              : 'No PESO-referred applicants yet. Job seekers whose NSRP profile is verified by PESO Misamis Oriental appear here when they apply.'}
          />
        )}
        renderItem={({ item }) => (
          <TouchableOpacity testID={`applicant-${item.application_id}`} onPress={() => openApplicant(item)} activeOpacity={0.82}>
            <Card style={styles.applicantCard}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {item.first_name} {item.middle_name} {item.last_name}
                  </Text>
                  <Text style={styles.detail}>{item.email}</Text>
                  <Text style={styles.detail}>
                    {item.education_level || 'Education not specified'}{item.course ? ` / ${item.course}` : ''}
                  </Text>
                  <Text style={styles.detail}>
                    {item.years_of_experience || 0} yr{item.years_of_experience === 1 ? '' : 's'} exp / {item.city || 'N/A'}
                  </Text>
                </View>
                <View style={styles.badgeStack}>
                  <StatusBadge status={item.application_status} />
                </View>
              </View>
              {item.total_required_skills > 0 ? (
                <View style={styles.matchSummary}>
                  <Text style={[styles.matchSummaryText, styles.matchChipGreen]}>Matched {item.matched_count || 0}</Text>
                  <Text style={[styles.matchSummaryText, (item.missing_count || 0) > 0 ? styles.matchChipAmber : styles.matchChipNeutral]}>
                    Missing {item.missing_count || 0}
                  </Text>
                  <Text style={[styles.matchSummaryText, styles.matchChipNeutral]}>Required {item.total_required_skills || 0}</Text>
                </View>
              ) : (
                <Text style={styles.noSkillsText}>No required skills encoded for comparison.</Text>
              )}
              <Text style={styles.cardHint}>Tap to review applicant details and update tracking status.</Text>
            </Card>
          </TouchableOpacity>
        )}
      />
      )}

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <ScrollView>
              <Text style={styles.modalTitle}>Applicant Details</Text>
              {/* A verified profile edited after applying goes back to PESO; the summary below is the edited, unchecked data. */}
              {selected?.nsrp_status && selected.nsrp_status !== 'verified' ? (
                <View style={styles.recheckNotice} testID="applicant-recheck">
                  <Text style={styles.recheckText}>Changed after PESO verification. Not yet re-verified by PESO.</Text>
                </View>
              ) : (
                <Text style={styles.modalSubtle}>NSRP profile verified by PESO Misamis Oriental. Review the NSRP profile summary before updating the application status.</Text>
              )}
              {selected && (
                <>
                  <Row left="Name" right={`${selected.first_name} ${selected.last_name}`} />
                  <Row left="Email" right={selected.email} />
                  <Row left="Contact" right={selected.contact_number || 'N/A'} />
                  <Row left="Location" right={`${selected.city || ''} ${selected.province || ''}`} />
                  <Row left="Education" right={selected.education_level || 'N/A'} />
                  <Row left="Course" right={selected.course || 'N/A'} />
                  <Row left="Experience" right={`${selected.years_of_experience || 0} yr`} />
                  <Row left="Employment" right={selected.employment_status || 'N/A'} />
                  <Row left="Preferred Job" right={selected.preferred_occupation || 'N/A'} />
                  {!!selected.referral_reviewed_at && (
                    <Row left="Applied" right={new Date(selected.referral_reviewed_at).toLocaleDateString()} />
                  )}
                  {/* The note was written when the profile was verified, so it is hidden while the profile is not verified. */}
                  {!!selected.referral_notes && (!selected.nsrp_status || selected.nsrp_status === 'verified') && (
                    <Row left="PESO Note" right={selected.referral_notes} />
                  )}
                  <Row
                    left="Skill Comparison"
                    right={`${selected.matched_count || 0} matched / ${selected.missing_count || 0} missing`}
                  />

                  {!!selected.skill_comparison_notice && (
                    <Text style={styles.comparisonNotice}>{selected.skill_comparison_notice}</Text>
                  )}

                  <SkillList
                    title="Matched Skills"
                    skills={selected.matched_skills || []}
                    matched
                    emptyText="No required skills matched."
                  />
                  <SkillList
                    title="Missing Required Skills"
                    tone="missing"
                    skills={selected.missing_required_skills || []}
                    emptyText="No missing required skills."
                  />
                  <SkillList
                    title="Applicant Skills"
                    skills={selected.applicant_skills || []}
                    emptyText="No skills encoded in the applicant profile."
                  />

                  {selected.cover_letter && (
                    <View style={{ marginTop: Spacing.md }}>
                      <Text style={styles.modalSub}>Cover Letter</Text>
                      <Text style={styles.coverLetter}>{selected.cover_letter}</Text>
                    </View>
                  )}

                  <Text style={[styles.modalSub, { marginTop: Spacing.md }]}>Update Status</Text>
                  <View style={styles.statusGrid}>
                    {STATUSES.map((s) => (
                      <View key={s} style={styles.statusButton}>
                        <Button
                          testID={`set-${s}`}
                          title={StatusLabels[s]}
                          variant={selected.application_status === s ? 'primary' : 'secondary'}
                          onPress={() => requestStatus(s)}
                          loading={updating}
                          disabled={selected.application_status === s || selected.application_status === 'closed'}
                        />
                      </View>
                    ))}
                  </View>

                  <View style={{ marginTop: Spacing.sm }}>
                    <Button testID="close-modal" title="Close" variant="secondary" onPress={() => setSelected(null)} />
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SkillList({
  title, skills, matched, emptyText, tone,
}: {
  title: string;
  skills: any[];
  matched?: boolean;
  emptyText: string;
  tone?: 'missing';
}) {
  const missing = tone === 'missing';
  return (
    <View style={styles.skillSection}>
      <Text style={[styles.modalSub, missing && styles.amberText]}>{title}</Text>
      {skills.length > 0 ? (
        <View style={styles.skillWrap}>
          {skills.map((skill) => (
            <View key={`${title}-${skill.id}`} style={[styles.skillPill, matched && styles.skillPillMatched, missing && styles.skillPillMissing]}>
              <Text style={[styles.skillText, matched && styles.skillTextMatched, missing && styles.amberText]}>{skill.skill_name}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptySkillText}>{emptyText}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.lightBg },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.primaryDark,
  },
  kicker: { color: Colors.cardHighlight, fontSize: FontSize.xs, fontWeight: '900' },
  headerTitle: { color: Colors.white, fontSize: FontSize.xl, fontWeight: '900', marginTop: 4 },
  headerSub: { color: Colors.cardHighlight, fontSize: FontSize.sm, marginTop: 4 },
  chooseJob: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginTop: Spacing.xs },
  chooseJobText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '900' },
  listContent: { padding: Spacing.md, paddingBottom: Spacing.xl },
  applicantCard: { borderRadius: Radius.lg },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.sm },
  badgeStack: { alignItems: 'flex-end', gap: Spacing.xs, maxWidth: 155 },
  matchSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  matchSummaryText: {
    color: Colors.primaryDark,
    backgroundColor: Colors.cardHighlight,
    borderColor: Colors.borderSoft,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: FontSize.xs,
    fontWeight: '800',
  },
  noSkillsText: { color: Colors.gray, fontSize: FontSize.xs, marginTop: Spacing.sm },
  cardHint: { color: Colors.gray, fontSize: FontSize.xs, marginTop: Spacing.sm },
  name: { fontSize: FontSize.md, fontWeight: '900', color: Colors.textDark },
  detail: { fontSize: FontSize.sm, color: Colors.gray, marginTop: 3 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    maxHeight: '88%',
    ...Shadow.raised,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '900', color: Colors.textDark },
  modalSubtle: { fontSize: FontSize.sm, color: Colors.gray, lineHeight: 20, marginTop: 4, marginBottom: Spacing.sm },
  modalSub: { fontSize: FontSize.sm, fontWeight: '900', color: Colors.primary, textTransform: 'uppercase' },
  comparisonNotice: { color: Colors.gray, fontSize: FontSize.xs, lineHeight: 18, marginTop: Spacing.sm },
  skillSection: { marginTop: Spacing.md },
  skillWrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: Spacing.sm },
  skillPill: {
    backgroundColor: Colors.white,
    borderColor: Colors.borderSoft,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
    marginBottom: 6,
  },
  skillPillMatched: { backgroundColor: Colors.cardHighlight, borderColor: Colors.primary },
  skillText: { color: Colors.textDark, fontSize: FontSize.xs, fontWeight: '700' },
  skillTextMatched: { color: Colors.primary, fontWeight: '800' },
  skillPillMissing: { backgroundColor: amber.bg, borderColor: amber.border },
  amberText: { color: amber.text },
  recheckNotice: { backgroundColor: amber.bg, borderColor: amber.border, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.sm, marginTop: 4, marginBottom: Spacing.sm },
  recheckText: { color: amber.text, fontSize: FontSize.sm, fontWeight: '800', lineHeight: 20 },
  matchChipGreen: { backgroundColor: Colors.cardHighlight, borderColor: Colors.primary, color: Colors.primary },
  matchChipAmber: { backgroundColor: amber.bg, borderColor: amber.border, color: amber.text },
  matchChipNeutral: { backgroundColor: Colors.surface, borderColor: Colors.borderSoft, color: Colors.gray },
  filterRow: { marginBottom: Spacing.sm },
  vacancyCard: {
    backgroundColor: Colors.white,
    borderColor: Colors.borderSoft,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  vacancyCardFilled: { borderColor: Colors.primary, borderLeftWidth: 5 },
  vacancyHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vacancyTitle: { color: Colors.textDark, fontSize: FontSize.md, fontWeight: '900' },
  vacancyCount: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '900', fontVariant: ['tabular-nums'] },
  vacancyTrack: { height: 8, borderRadius: 4, backgroundColor: Colors.borderSoft, marginTop: 8, overflow: 'hidden' },
  vacancyFill: { height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  vacancyText: { color: Colors.gray, fontSize: FontSize.xs, lineHeight: 18, marginTop: Spacing.sm },
  vacancyLink: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: Spacing.sm },
  vacancyLinkText: { color: Colors.gray, fontSize: FontSize.xs, fontWeight: '800' },
  emptySkillText: { color: Colors.gray, fontSize: FontSize.xs, marginTop: Spacing.sm },
  coverLetter: {
    fontSize: FontSize.sm,
    color: Colors.textDark,
    marginTop: 4,
    lineHeight: 20,
    backgroundColor: Colors.surface,
    padding: 10,
    borderRadius: Radius.sm,
  },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  statusButton: { width: '48%' },
});
