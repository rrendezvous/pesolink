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
import { Colors, Spacing, FontSize } from '../../../src/constants/theme';

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
    return <View style={styles.center}><Text>Loading...</Text></View>;
  }
  if (!job) {
    return <EmptyState message="Job not found." />;
  }

  const alreadyApplied = !!job.my_application;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={styles.title}>{job.job_title}</Text>
          <Text style={styles.company}>{job.company_name}</Text>
          {job.location && <Text style={styles.meta}>📍 {job.location}</Text>}
          <Text style={styles.meta}>💼 {job.job_type} • {job.vacancies} vacanc{job.vacancies > 1 ? 'ies' : 'y'}</Text>
          {job.salary_min && (
            <Text style={styles.meta}>
              💰 ₱{Number(job.salary_min).toLocaleString()} - ₱{Number(job.salary_max).toLocaleString()}
            </Text>
          )}
          {job.closing_date && <Text style={styles.meta}>📅 Closes: {new Date(job.closing_date).toLocaleDateString()}</Text>}
        </Card>

        <Card style={{ backgroundColor: Colors.surface }}>
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
          <Card>
            <Text style={styles.section}>Skill Comparison</Text>
            <Text style={styles.disclaimer}>{match.notice}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: Spacing.sm }}>
              <View style={[styles.statBox, { backgroundColor: Colors.accent }]}>
                <Text style={styles.statBoxNum}>{match.matched_count}</Text>
                <Text style={styles.statBoxLabel}>Matched</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: Colors.surface, borderColor: Colors.border, borderWidth: 1 }]}>
                <Text style={[styles.statBoxNum, { color: Colors.textDark }]}>{match.unmatched_count}</Text>
                <Text style={[styles.statBoxLabel, { color: Colors.textDark }]}>Unmatched</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: Colors.cardHighlight, borderColor: Colors.border, borderWidth: 1 }]}>
                <Text style={[styles.statBoxNum, { color: Colors.textDark }]}>{match.total_required}</Text>
                <Text style={[styles.statBoxLabel, { color: Colors.textDark }]}>Required</Text>
              </View>
            </View>

            {match.matched_skills.length > 0 && (
              <>
                <Text style={styles.subSection}>Skills you have ({match.matched_count})</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {match.matched_skills.map((s: any) => (
                    <View key={s.id} style={[styles.skillPill, { backgroundColor: Colors.accent, borderColor: Colors.accent }]}>
                      <Text style={{ color: Colors.white, fontSize: FontSize.xs, fontWeight: '600' }}>✓ {s.skill_name}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
            {match.unmatched_required_skills.length > 0 && (
              <>
                <Text style={[styles.subSection, { marginTop: Spacing.sm }]}>Skills you're missing ({match.unmatched_count})</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {match.unmatched_required_skills.map((s: any) => (
                    <View key={s.id} style={styles.skillPill}>
                      <Text style={{ color: Colors.textDark, fontSize: FontSize.xs }}>{s.skill_name}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </Card>
        )}

        <Card>
          {alreadyApplied ? (
            <View>
              <Text style={styles.section}>Your Application</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <Text style={{ color: Colors.gray, fontSize: FontSize.sm }}>Status:</Text>
                <StatusBadge status={job.my_application.application_status} />
              </View>
              <Text style={{ color: Colors.gray, fontSize: FontSize.xs, marginTop: 6 }}>
                Applied on {new Date(job.my_application.applied_at).toLocaleDateString()}
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.section}>Apply for this Job</Text>
              <Input
                testID="cover-letter"
                label="Cover Letter (optional)"
                value={coverLetter}
                onChangeText={setCoverLetter}
                placeholder="Why are you a good fit for this role?"
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.lightBg, padding: Spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textDark },
  company: { fontSize: FontSize.md, color: Colors.primary, fontWeight: '600', marginTop: 4 },
  meta: { color: Colors.gray, fontSize: FontSize.sm, marginTop: 4 },
  section: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark, marginBottom: Spacing.sm },
  subSection: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary, marginTop: 8, marginBottom: 6, textTransform: 'uppercase' },
  body: { color: Colors.textDark, fontSize: FontSize.sm, lineHeight: 20 },
  disclaimer: { color: Colors.gray, fontSize: FontSize.xs, fontStyle: 'italic' },
  statBox: { flex: 1, borderRadius: 10, padding: 12, alignItems: 'center' },
  statBoxNum: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.white },
  statBoxLabel: { fontSize: FontSize.xs, color: Colors.white, fontWeight: '600', marginTop: 2 },
  skillPill: {
    backgroundColor: Colors.white, borderColor: Colors.border, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginRight: 6, marginBottom: 6,
  },
});
