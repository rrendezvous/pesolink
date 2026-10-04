// ============================================================
// Job Details + Skill Match + Apply with PESO Referral (combined)
// ============================================================
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Input, Card, StatusBadge, EmptyState, Row } from '../../../src/components/ui';
import { formatDate } from '../../../src/components/NsrpProfileView';
import { api, getApiError } from '../../../src/api/client';
import { canRequestAgain, currentStatus, nsrpStatusMessage } from '../../../src/utils/referral';
import { Colors, Spacing, FontSize, Radius } from '../../../src/constants/theme';

export default function JobDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<any>(null);
  const [match, setMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [j, m] = await Promise.all([
          api.get(`/jobs/${id}`),
          api.get(`/jobs/${id}/match`).catch(() => ({ data: null })),
        ]);
        setJob(j.data.job);
        setMatch(m.data);
      } catch (err) {
        Alert.alert('Error', getApiError(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleApply = async () => {
    setApplying(true);
    try {
      const { data } = await api.post('/applications', { job_post_id: Number(id), cover_letter: coverLetter || null });
      Alert.alert(
        'Application Sent',
        `${data.message}. The employer will update your status. Track it under My Applications.`,
        [{ text: 'OK', onPress: () => router.replace('/(seeker)/my-applications') }],
      );
    } catch (err: any) {
      const code = err?.response?.data?.code;
      if (code === 'NSRP_NOT_VERIFIED') {
        Alert.alert('NSRP Profile Not Yet Verified', getApiError(err), [
          { text: 'Later', style: 'cancel' },
          { text: 'Open Profile', onPress: () => router.push('/(seeker)/profile') },
        ]);
      } else if (code === 'SKILL_MINIMUM') {
        Alert.alert('Not Enough Matching Skills', getApiError(err), [
          { text: 'OK', style: 'cancel' },
          { text: 'Update Skills', onPress: () => router.push('/(seeker)/profile') },
        ]);
      } else {
        Alert.alert('Application Failed', getApiError(err));
      }
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><Text style={styles.loadingText}>Loading...</Text></View>;
  }
  if (!job) {
    return <EmptyState message="Job not found." />;
  }

  const myRequest = job.my_application;
  const canApplyHere = !myRequest || canRequestAgain(myRequest.referral_status);
  const nsrpStatus: string = job.my_nsrp_status || 'not_submitted';
  const meetsMinimum = !match || match.meets_minimum !== false;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.kicker}>PESO-Link MisOr</Text>
          <Text style={styles.headerTitle}>Job Details</Text>
        </View>

        <Card style={styles.heroCard}>
          <View style={styles.companyMark}>
            <Text style={styles.companyMarkText}>{(job.company_name || 'P').charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.title}>{job.job_title}</Text>
          <Text style={styles.company}>{job.company_name}</Text>
          <View style={styles.metaGrid}>
            {job.location && <MetaBox label="Location" value={job.location} />}
            <MetaBox label="Type" value={job.job_type} />
            <MetaBox label="Vacancies" value={`${job.vacancies} ${job.vacancies > 1 ? 'slots' : 'slot'}`} />
            {job.closing_date && <MetaBox label="Closes" value={formatDate(job.closing_date)} />}
          </View>
          {(job.salary_min || job.salary_max) && (
            <Text style={styles.salary}>{formatSalary(job.salary_min, job.salary_max)}</Text>
          )}
          {job.posted_at && (
            <Text style={styles.postedText}>Posted {new Date(job.posted_at).toLocaleDateString()}</Text>
          )}
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.section}>Employer Details</Text>
          <Row left="Company" right={job.company_name || 'N/A'} />
          {!!job.business_type && <Row left="Industry" right={job.business_type} />}
          {!!job.company_address && <Row left="Address" right={job.company_address} />}
          {!!job.contact_person && <Row left="Contact Person" right={job.contact_person} />}
          {!!job.contact_number && <Row left="Contact Number" right={job.contact_number} />}
          <Text style={styles.employerNote}>
            Applications are routed through PESO-Link MisOr. Track your status under My Applications.
          </Text>
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.section}>Description</Text>
          <Text style={styles.body}>{job.job_description}</Text>
          {job.requirements && (
            <>
              <Text style={[styles.section, { marginTop: Spacing.md }]}>Requirements / Application Instructions</Text>
              <Text style={styles.body}>{job.requirements}</Text>
            </>
          )}
        </Card>

        {match && (
          <Card style={styles.sectionCard}>
            <Text style={styles.section}>Rule-Based Skill Comparison</Text>
            <Text style={styles.disclaimer}>{match.notice}</Text>
            {match.required_matches > 0 && (
              <Text style={[styles.minimumNote, !match.meets_minimum && styles.minimumNoteShort]}>
                {match.meets_minimum
                  ? `Meets the minimum of ${match.required_matches} matching skills for applying with PESO referral.`
                  : `Applying with PESO referral needs at least ${match.required_matches} matching skills. You have ${match.matched_count}.`}
              </Text>
            )}
            <View style={styles.matchRow}>
              <MatchBox label="Matched" value={match.matched_count} active />
              <MatchBox label="Missing" value={match.unmatched_count} />
              <MatchBox label="Required" value={match.total_required} />
            </View>

            {match.matched_skills.length > 0 && (
              <>
                <Text style={styles.subSection}>Matched skills</Text>
                <View style={styles.pillWrap}>
                  {match.matched_skills.map((s: any) => (
                    <View key={s.id} style={[styles.skillPill, styles.skillPillMatched]}>
                      <Text style={styles.skillPillMatchedText}>{s.skill_name}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
            {match.unmatched_required_skills.length > 0 && (
              <>
                <Text style={styles.subSection}>Missing required skills</Text>
                <View style={styles.pillWrap}>
                  {match.unmatched_required_skills.map((s: any) => (
                    <View key={s.id} style={styles.skillPill}>
                      <Text style={styles.skillPillText}>{s.skill_name}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </Card>
        )}

        {myRequest && (
          <Card style={styles.sectionCard}>
            <Text style={styles.section}>Your Application</Text>
            <View style={styles.applicationStatus}>
              <StatusBadge status={currentStatus(myRequest).status} />
              <Text style={styles.statusNote}>{referralNote(myRequest.referral_status)}</Text>
              <Text style={styles.statusNote}>Applied on {new Date(myRequest.applied_at).toLocaleDateString()}</Text>
              {!!myRequest.referral_notes && (
                <Text style={styles.pesoNote}>PESO note: {myRequest.referral_notes}</Text>
              )}
            </View>
          </Card>
        )}

        {canApplyHere && nsrpStatus === 'verified' && (
          <Card style={styles.sectionCard}>
            <Text style={styles.section}>Apply with PESO Referral</Text>
            <Text style={styles.helpText}>
              Your NSRP profile is PESO-verified. Your application goes straight to {job.company_name} labelled PESO-Referred.
            </Text>
            {meetsMinimum ? (
              <>
                <Input
                  testID="cover-letter"
                  label="Cover Letter (optional)"
                  value={coverLetter}
                  onChangeText={setCoverLetter}
                  placeholder="Add a short note for the employer."
                  multiline
                  numberOfLines={4}
                />
                <Button testID="apply-btn" title="Apply with PESO Referral" onPress={handleApply} loading={applying} />
              </>
            ) : (
              <>
                <Text style={styles.pesoNote}>
                  You need at least {match.required_matches} of this job&apos;s required skills in your NSRP profile to apply with PESO referral.
                </Text>
                <Button title="Update My Skills" variant="secondary" style={{ marginTop: Spacing.md }} onPress={() => router.push('/(seeker)/profile')} />
              </>
            )}
          </Card>
        )}

        {canApplyHere && nsrpStatus !== 'verified' && (
          <Card style={styles.sectionCard}>
            <Text style={styles.section}>Apply with PESO Referral</Text>
            <View style={styles.applicationStatus}>
              <StatusBadge status={nsrpStatus as any} />
              <Text style={styles.statusNote}>{nsrpStatusMessage(nsrpStatus)}</Text>
            </View>
            {['not_submitted', 'needs_revision'].includes(nsrpStatus) && (
              <Button
                title={nsrpStatus === 'needs_revision' ? 'Fix and Resubmit NSRP Profile' : 'Submit NSRP Profile to PESO'}
                onPress={() => router.push('/(seeker)/profile')}
                style={{ marginTop: Spacing.md }}
              />
            )}
          </Card>
        )}

        {!!job.application_email && (
          <Card style={styles.sectionCard}>
            <Text style={styles.section}>Apply Directly to the Employer</Text>
            <Row left="Application Email" right={job.application_email} />
            <Text style={styles.helpText}>
              You may also email your application directly. Direct applications are handled outside PESO-Link and are not tracked here.
            </Text>
          </Card>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function referralNote(referralStatus?: string) {
  if (referralStatus === 'peso_referred') return 'Sent to the employer as PESO-Referred. The employer updates this status.';
  if (referralStatus === 'rejected') return 'PESO did not endorse this earlier request. You can apply again.';
  if (referralStatus === 'closed') return 'This earlier request was closed. You can apply again.';
  return 'Waiting on PESO Misamis Oriental.';
}

function formatSalary(min: any, max: any) {
  const fmt = (v: any) => `PHP ${Number(v).toLocaleString()}`;
  if (min && max) return `${fmt(min)} - ${fmt(max)}`;
  return min ? `From ${fmt(min)}` : `Up to ${fmt(max)}`;
}

function MetaBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaBox}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function MatchBox({ label, value, active }: { label: string; value: number; active?: boolean }) {
  return (
    <View style={[styles.matchBox, active && styles.matchBoxActive]}>
      <Text style={[styles.matchValue, active && styles.matchValueActive]}>{value}</Text>
      <Text style={[styles.matchLabel, active && styles.matchLabelActive]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.lightBg },
  content: { paddingBottom: Spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.lightBg },
  loadingText: { color: Colors.textDark, fontSize: FontSize.md },
  header: {
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  kicker: { color: Colors.cardHighlight, fontSize: FontSize.xs, fontWeight: '900' },
  headerTitle: { color: Colors.white, fontSize: FontSize.xl, fontWeight: '900', marginTop: 4 },
  heroCard: { margin: Spacing.md, marginBottom: Spacing.sm, alignItems: 'flex-start' },
  companyMark: {
    width: 60, height: 60, borderRadius: Radius.md,
    backgroundColor: Colors.cardHighlight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  companyMarkText: { color: Colors.primary, fontSize: FontSize.xl, fontWeight: '900' },
  title: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.textDark },
  company: { fontSize: FontSize.md, color: Colors.gray, fontWeight: '700', marginTop: 4 },
  salary: { color: Colors.primaryDark, fontSize: FontSize.md, fontWeight: '900', marginTop: Spacing.md },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md },
  metaBox: {
    backgroundColor: Colors.muted,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: '47%',
  },
  metaLabel: { color: Colors.gray, fontSize: FontSize.xs, fontWeight: '800' },
  metaValue: { color: Colors.textDark, fontSize: FontSize.sm, fontWeight: '800', marginTop: 2, textTransform: 'capitalize' },
  sectionCard: { marginHorizontal: Spacing.md, marginTop: Spacing.sm },
  section: { fontSize: FontSize.md, fontWeight: '900', color: Colors.textDark, marginBottom: Spacing.sm },
  subSection: { fontSize: FontSize.sm, fontWeight: '900', color: Colors.primary, marginTop: Spacing.md, marginBottom: 6 },
  body: { color: Colors.textDark, fontSize: FontSize.sm, lineHeight: 21 },
  disclaimer: { color: Colors.gray, fontSize: FontSize.xs, lineHeight: 18 },
  matchRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  matchBox: {
    flex: 1,
    backgroundColor: Colors.muted,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  matchBoxActive: { backgroundColor: Colors.primary },
  matchValue: { color: Colors.textDark, fontSize: FontSize.xl, fontWeight: '900' },
  matchValueActive: { color: Colors.white },
  matchLabel: { color: Colors.gray, fontSize: FontSize.xs, fontWeight: '800', marginTop: 2 },
  matchLabelActive: { color: Colors.white },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  skillPill: {
    backgroundColor: Colors.white,
    borderColor: Colors.borderSoft,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    marginRight: 6,
    marginBottom: 6,
  },
  skillPillMatched: { backgroundColor: Colors.cardHighlight, borderColor: Colors.primary },
  skillPillText: { color: Colors.textDark, fontSize: FontSize.xs, fontWeight: '700' },
  skillPillMatchedText: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: '800' },
  applicationStatus: {
    backgroundColor: Colors.cardHighlight,
    borderColor: Colors.borderSoft,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  statusLabel: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: '900', marginBottom: Spacing.sm },
  statusNote: { color: Colors.gray, fontSize: FontSize.xs, marginTop: Spacing.sm },
  helpText: { color: Colors.gray, fontSize: FontSize.xs, lineHeight: 18, marginTop: 4, marginBottom: Spacing.md },
  pesoNote: { color: '#92400E', fontSize: FontSize.sm, fontWeight: '700', lineHeight: 20, marginTop: Spacing.sm },
  minimumNote: { color: Colors.primaryDark, fontSize: FontSize.xs, fontWeight: '800', marginTop: Spacing.sm },
  minimumNoteShort: { color: '#92400E' },
  postedText: { color: Colors.gray, fontSize: FontSize.xs, marginTop: Spacing.xs },
  employerNote: { color: Colors.gray, fontSize: FontSize.xs, lineHeight: 18, marginTop: Spacing.sm },
});
