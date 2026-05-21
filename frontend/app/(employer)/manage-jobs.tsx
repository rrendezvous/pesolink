// ============================================================
// Manage Jobs - Employer
// ============================================================
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, Alert, TouchableOpacity,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Button, EmptyState } from '../../src/components/ui';
import { api, getApiError } from '../../src/api/client';
import { Colors, Spacing, FontSize } from '../../src/constants/theme';

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

  const deleteJob = (id: number) => {
    Alert.alert('Delete Job', 'Are you sure you want to delete this job post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/employer/jobs/${id}`);
            await load();
          } catch (err) {
            Alert.alert('Error', getApiError(err));
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.kicker}>PESO MIS.OR</Text>
        <Text style={styles.headerTitle}>Jobs</Text>
      </View>

      <View style={styles.topBar}>
        <Button testID="new-job-btn" title="Post New Job" onPress={() => router.push('/(employer)/job-form')} />
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
                <Text style={styles.meta}>{item.applicant_count || 0} applicant{item.applicant_count === 1 ? '' : 's'}</Text>
              </View>
              <View style={[styles.statusPill, item.status === 'active' ? styles.statusActive : styles.statusInactive]}>
                <Text style={styles.statusText}>{item.status}</Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                testID={`view-applicants-${item.id}`}
                style={styles.linkButton}
                onPress={() => router.push({ pathname: '/(employer)/applicants', params: { jobId: item.id, jobTitle: item.job_title } })}
              >
                <Text style={styles.linkButtonText}>Applicants</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID={`edit-job-${item.id}`}
                style={styles.linkButton}
                onPress={() => router.push({ pathname: '/(employer)/job-form', params: { jobId: item.id } })}
              >
                <Text style={styles.linkButtonText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity testID={`delete-job-${item.id}`} style={[styles.linkButton, styles.deleteButton]} onPress={() => deleteJob(item.id)}>
                <Text style={[styles.linkButtonText, { color: Colors.error }]}>Delete</Text>
              </TouchableOpacity>
            </View>
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
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  jobHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { fontSize: FontSize.md, fontWeight: '900', color: Colors.textDark },
  meta: { fontSize: FontSize.sm, color: Colors.gray, marginTop: 4, textTransform: 'capitalize' },
  statusPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  statusActive: { backgroundColor: Colors.cardHighlight },
  statusInactive: { backgroundColor: Colors.muted },
  statusText: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: '900', textTransform: 'uppercase' },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  linkButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderColor: Colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  deleteButton: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
  linkButtonText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '900' },
});
