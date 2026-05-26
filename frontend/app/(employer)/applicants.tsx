// ============================================================
// Job Applicants + Status Update (combined)
// ============================================================
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Alert, Modal, TouchableOpacity, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Card, Button, StatusBadge, EmptyState, Row } from '../../src/components/ui';
import { api, getApiError } from '../../src/api/client';
import { Colors, Spacing, FontSize, Radius, Shadow, StatusLabels } from '../../src/constants/theme';

const STATUSES = ['for_review', 'for_interview', 'hired', 'rejected'] as const;

export default function Applicants() {
  const { jobId, jobTitle } = useLocalSearchParams<{ jobId: string; jobTitle: string }>();
  const [applicants, setApplicants] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);

  const load = async () => {
    try {
      const res = await api.get(`/employer/jobs/${jobId}/applicants`);
      setApplicants(res.data.applicants || []);
    } catch (err) {
      console.warn(getApiError(err));
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [jobId]));

  const updateStatus = async (newStatus: string) => {
    if (!selected) return;
    try {
      await api.put(`/employer/applications/${selected.application_id}/status`, { status: newStatus });
      Alert.alert('Status Updated', `Applicant status set to "${StatusLabels[newStatus as keyof typeof StatusLabels]}".`);
      setSelected(null);
      await load();
    } catch (err) {
      Alert.alert('Error', getApiError(err));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.kicker}>PESO-Link MisOr</Text>
        <Text style={styles.headerTitle}>Applicants</Text>
        <Text style={styles.headerSub}>{jobTitle || 'Selected job post'}</Text>
      </View>

      <FlatList
        data={applicants}
        keyExtractor={(item) => String(item.application_id)}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<EmptyState message="No applicants yet for this job." />}
        renderItem={({ item }) => (
          <TouchableOpacity testID={`applicant-${item.application_id}`} onPress={() => setSelected(item)} activeOpacity={0.82}>
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
                  <View style={[styles.referralPill, getReferralPillStyle(item.referral_status)]}>
                    <Text style={[styles.referralPillText, item.referral_status === 'referral_ready' && styles.referralPillTextReady]}>
                      {getReferralShort(item.referral_status)}
                    </Text>
                  </View>
                </View>
              </View>
              {item.total_required_skills > 0 ? (
                <View style={styles.matchSummary}>
                  <Text style={styles.matchSummaryText}>Matched {item.matched_count || 0}</Text>
                  <Text style={styles.matchSummaryText}>Missing {item.missing_count || 0}</Text>
                  <Text style={styles.matchSummaryText}>Required {item.total_required_skills || 0}</Text>
                </View>
              ) : (
                <Text style={styles.noSkillsText}>No required skills encoded for comparison.</Text>
              )}
              <Text style={styles.cardHint}>Tap to review applicant details and update tracking status.</Text>
            </Card>
          </TouchableOpacity>
        )}
      />

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <ScrollView>
              <Text style={styles.modalTitle}>Applicant Details</Text>
              <Text style={styles.modalSubtle}>Review NSRP profile summary before updating the application status.</Text>
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
                  <Row
                    left="PESO Review"
                    right={getReferralLabel(selected.referral_status)}
                    style={selected.referral_status === 'referral_ready' ? styles.readyText : undefined}
                  />
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
                          onPress={() => updateStatus(s)}
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
  title, skills, matched, emptyText,
}: {
  title: string;
  skills: any[];
  matched?: boolean;
  emptyText: string;
}) {
  return (
    <View style={styles.skillSection}>
      <Text style={styles.modalSub}>{title}</Text>
      {skills.length > 0 ? (
        <View style={styles.skillWrap}>
          {skills.map((skill) => (
            <View key={`${title}-${skill.id}`} style={[styles.skillPill, matched && styles.skillPillMatched]}>
              <Text style={[styles.skillText, matched && styles.skillTextMatched]}>{skill.skill_name}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptySkillText}>{emptyText}</Text>
      )}
    </View>
  );
}

function getReferralLabel(status?: string) {
  if (status === 'submitted') return 'Submitted to PESO';
  if (status === 'needs_revision') return 'Needs Revision';
  if (status === 'referral_ready') return 'PESO Referral-Ready';
  return 'Draft';
}

function getReferralShort(status?: string) {
  if (status === 'submitted') return 'PESO Review';
  if (status === 'needs_revision') return 'Needs Revision';
  if (status === 'referral_ready') return 'Referral-Ready';
  return 'Draft';
}

function getReferralPillStyle(status?: string) {
  if (status === 'referral_ready') return styles.referralPillReady;
  if (status === 'needs_revision') return styles.referralPillWarning;
  if (status === 'submitted') return styles.referralPillSubmitted;
  return styles.referralPillDraft;
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
  listContent: { padding: Spacing.md, paddingBottom: Spacing.xl },
  applicantCard: { borderRadius: Radius.lg },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.sm },
  badgeStack: { alignItems: 'flex-end', gap: Spacing.xs, maxWidth: 155 },
  referralPill: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  referralPillReady: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  referralPillWarning: { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' },
  referralPillSubmitted: { backgroundColor: Colors.cardHighlight, borderColor: Colors.primarySoft },
  referralPillDraft: { backgroundColor: Colors.surface, borderColor: Colors.borderSoft },
  referralPillText: { color: Colors.textDark, fontSize: FontSize.xs, fontWeight: '900', textAlign: 'center' },
  referralPillTextReady: { color: Colors.white },
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
  readyText: { color: Colors.primary },
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
