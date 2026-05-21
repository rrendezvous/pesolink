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
import { Colors, Spacing, FontSize, StatusLabels } from '../../src/constants/theme';

const STATUSES = ['submitted', 'pending', 'for_review', 'referred', 'rejected', 'closed'] as const;

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
    <View style={{ flex: 1, backgroundColor: Colors.lightBg }}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Applicants for</Text>
        <Text style={styles.headerTitle}>{jobTitle}</Text>
      </View>

      <FlatList
        data={applicants}
        keyExtractor={(item) => String(item.application_id)}
        contentContainerStyle={{ padding: Spacing.md }}
        ListEmptyComponent={<EmptyState message="No applicants yet for this job." />}
        renderItem={({ item }) => (
          <TouchableOpacity testID={`applicant-${item.application_id}`} onPress={() => setSelected(item)}>
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {item.first_name} {item.middle_name} {item.last_name}
                  </Text>
                  <Text style={styles.detail}>{item.email}</Text>
                  <Text style={styles.detail}>
                    {item.education_level} {item.course ? `· ${item.course}` : ''}
                  </Text>
                  <Text style={styles.detail}>
                    {item.years_of_experience} yr{item.years_of_experience === 1 ? '' : 's'} exp • {item.city || 'N/A'}
                  </Text>
                </View>
                <StatusBadge status={item.application_status} />
              </View>
            </Card>
          </TouchableOpacity>
        )}
      />

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <ScrollView>
              <Text style={styles.modalTitle}>Applicant Details</Text>
              {selected && (
                <>
                  <Row left="Name" right={`${selected.first_name} ${selected.last_name}`} />
                  <Row left="Email" right={selected.email} />
                  <Row left="Contact" right={selected.contact_number || 'N/A'} />
                  <Row left="Location" right={`${selected.city || ''} ${selected.province || ''}`} />
                  <Row left="Education" right={selected.education_level || 'N/A'} />
                  <Row left="Course" right={selected.course || 'N/A'} />
                  <Row left="Experience" right={`${selected.years_of_experience} yr`} />
                  <Row left="Employment" right={selected.employment_status || 'N/A'} />
                  <Row left="Preferred Job" right={selected.preferred_occupation || 'N/A'} />

                  {selected.cover_letter && (
                    <View style={{ marginTop: Spacing.md }}>
                      <Text style={styles.modalSub}>Cover Letter</Text>
                      <Text style={styles.coverLetter}>{selected.cover_letter}</Text>
                    </View>
                  )}

                  <Text style={[styles.modalSub, { marginTop: Spacing.md }]}>Update Status</Text>
                  <View style={{ marginTop: 6 }}>
                    {STATUSES.map((s) => (
                      <View key={s} style={{ marginBottom: 8 }}>
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

const styles = StyleSheet.create({
  header: { padding: Spacing.md, backgroundColor: Colors.primaryDark },
  headerLabel: { color: Colors.cardHighlight, fontSize: FontSize.xs },
  headerTitle: { color: Colors.white, fontSize: FontSize.lg, fontWeight: '700', marginTop: 2 },
  name: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark },
  detail: { fontSize: FontSize.sm, color: Colors.gray, marginTop: 2 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.md, maxHeight: '88%' },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textDark, marginBottom: Spacing.sm },
  modalSub: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary, textTransform: 'uppercase' },
  coverLetter: { fontSize: FontSize.sm, color: Colors.textDark, marginTop: 4, lineHeight: 20, backgroundColor: Colors.surface, padding: 10, borderRadius: 8 },
});
