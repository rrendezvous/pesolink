// ============================================================
// Manage Jobs - Employer
// ============================================================
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, Alert, TouchableOpacity,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, EmptyState } from '../../src/components/ui';
import { api, getApiError } from '../../src/api/client';
import { Colors, Spacing, FontSize, Radius, Shadow } from '../../src/constants/theme';

export default function ManageJobs() {
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await api.get('/employer/jobs');
      setJobs(res.data.jobs || []);
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

  const closeJob = (id: number, title: string) => {
    Alert.alert(
      `Close "${title}"?`,
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
              await api.put(`/employer/jobs/${id}/close`);
              await load();
            } catch (err) {
              Alert.alert('Error', getApiError(err));
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.kicker}>PESO-Link MisOr</Text>
        <Text style={styles.headerTitle}>Jobs</Text>
      </View>

      <View style={styles.topBar}>
        <Button testID="new-job-btn" title="Post New Job" onPress={() => router.push({ pathname: '/(employer)/job-form', params: { jobId: '' } })} />
      </View>

      <FlatList
        data={jobs}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={<EmptyState message="No job posts yet. Tap Post New Job to begin." />}
        renderItem={({ item }) => (
          <View style={styles.jobCard}>
            <View style={styles.jobHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.job_title}</Text>
                <Text style={styles.meta}>{item.job_type} / {item.location || 'N/A'}</Text>
                <Text style={styles.meta}>{item.applicant_count || 0} PESO-referred applicant{item.applicant_count === 1 ? '' : 's'}</Text>
              </View>
              <View style={[styles.statusPill, item.status === 'active' ? styles.statusActive : styles.statusInactive]}>
                <Text style={styles.statusText}>{item.status}</Text>
              </View>
            </View>

            {/* Applicants is the main action; Edit is secondary; closing is a quiet link (it still asks to confirm). */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                testID={`view-applicants-${item.id}`}
                style={[styles.linkButton, styles.primaryButton]}
                onPress={() => router.push({ pathname: '/(employer)/applicants', params: { jobId: item.id, jobTitle: item.job_title } })}
                accessibilityRole="button"
              >
                <Ionicons name="people-outline" size={18} color={Colors.white} />
                <Text style={[styles.linkButtonText, styles.primaryButtonText]}>Applicants ({item.applicant_count || 0})</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID={`edit-job-${item.id}`}
                style={[styles.linkButton, styles.secondaryButton]}
                onPress={() => router.push({ pathname: '/(employer)/job-form', params: { jobId: item.id } })}
                accessibilityRole="button"
              >
                <Ionicons name="create-outline" size={18} color={Colors.primary} />
                <Text style={styles.linkButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
            {item.status !== 'closed' && (
              <TouchableOpacity
                testID={`close-job-${item.id}`}
                style={styles.closeLink}
                onPress={() => closeJob(item.id, item.job_title)}
                accessibilityRole="button"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="lock-closed-outline" size={14} color={Colors.gray} />
                <Text style={styles.closeLinkText}>Stop accepting applications</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />
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
  topBar: { padding: Spacing.md, paddingBottom: Spacing.sm },
  listContent: { padding: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.xl },
  jobCard: {
    backgroundColor: Colors.white,
    borderColor: Colors.borderSoft,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.card,
  },
  jobHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { fontSize: FontSize.md, fontWeight: '900', color: Colors.textDark },
  meta: { fontSize: FontSize.sm, color: Colors.gray, marginTop: 4, textTransform: 'capitalize' },
  statusPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill },
  statusActive: { backgroundColor: Colors.cardHighlight },
  statusInactive: { backgroundColor: Colors.muted },
  statusText: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: '900', textTransform: 'uppercase' },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  linkButton: {
    minHeight: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: { flex: 2, backgroundColor: Colors.primary, borderColor: Colors.primary },
  primaryButtonText: { color: Colors.white },
  secondaryButton: { flex: 1, backgroundColor: Colors.white, borderColor: Colors.primary },
  linkButtonText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '900' },
  closeLink: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', marginTop: Spacing.sm },
  closeLinkText: { color: Colors.gray, fontSize: FontSize.xs, fontWeight: '800' },
});
