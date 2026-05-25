// ============================================================
// Job Details + Skill Match + Apply (combined)
// ============================================================
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Input, Card, StatusBadge, EmptyState } from '../../../src/components/ui';
import { api, getApiError } from '../../../src/api/client';
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
      await api.post('/applications', { job_post_id: Number(id), cover_letter: coverLetter || null });
      Alert.alert('Application Submitted', 'Your application has been sent to the employer.', [
        { text: 'OK', onPress: () => router.replace('/(seeker)/my-applications') },
      ]);
    } catch (err) {
      Alert.alert('Apply Failed', getApiError(err));
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

  const alreadyApplied = !!job.my_application;

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
            {job.closing_date && <MetaBox label="Closes" value={new Date(job.closing_date).toLocaleDateString()} />}
          </View>
          {job.salary_min && (
            <Text style={styles.salary}>
              PHP {Number(job.salary_min).toLocaleString()} - PHP {Number(job.salary_max).toLocaleString()}
            </Text>
          )}
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.section}>Description</Text>
          <Text style={styles.body}>{job.job_description}</Text>
          {job.requirements && (
            <>
              <Text style={[styles.section, { marginTop: Spacing.md }]}>Requirements</Text>
              <Text style={styles.body}>{job.requirements}</Text>
            </>
          )}
        </Card>

        {match && (
          <Card style={styles.sectionCard}>
            <Text style={styles.section}>Rule-Based Skill Comparison</Text>
            <Text style={styles.disclaimer}>{match.notice}</Text>
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

        <Card style={styles.sectionCard}>
          {alreadyApplied ? (
            <View>
              <Text style={styles.section}>Your Application</Text>
              <View style={styles.applicationStatus}>
                <Text style={styles.statusLabel}>Application Status</Text>
                <StatusBadge status={job.my_application.application_status} />
                <Text style={styles.statusNote}>
                  Applied on {new Date(job.my_application.applied_at).toLocaleDateString()}
                </Text>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.section}>Apply for this Job</Text>
              <Input
                testID="cover-letter"
                label="Cover Letter (optional)"
                value={coverLetter}
                onChangeText={setCoverLetter}
                placeholder="Add a short note for the employer."
                multiline
                numberOfLines={4}
              />
              <Button testID="apply-btn" title="Submit Application" onPress={handleApply} loading={applying} />
            </>
          )}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
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
});
