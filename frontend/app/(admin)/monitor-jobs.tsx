// ============================================================
// Monitor Jobs - Admin (with soft-close action; no hard delete)
// ============================================================
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Card, Button, EmptyState } from '../../src/components/ui';
import { api, getApiError } from '../../src/api/client';
import { confirmAction } from '../../src/utils/confirm';
import { Colors, Spacing, FontSize } from '../../src/constants/theme';

export default function MonitorJobs() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async () => {
    try {
      const res = await api.get('/admin/jobs');
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

  const closeJob = (job: any) => {
    confirmAction(
      'Close Job Post',
      `Close "${job.job_title}"? This is a soft removal. The record is retained for monitoring and audit.`,
      async () => {
        setBusyId(job.id);
        try {
          await api.put(`/admin/jobs/${job.id}/close`);
          await load();
        } catch (err) {
          Alert.alert('Error', getApiError(err));
        } finally {
          setBusyId(null);
        }
      },
      'Close Job',
      true,
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.kicker}>PESO MIS.OR</Text>
        <Text style={styles.headerTitle}>Job Posts</Text>
        <Text style={styles.headerSub}>Monitor employer postings and soft-close when needed</Text>
      </View>
      <FlatList
        data={jobs}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={<EmptyState message="No job posts in the system yet." />}
        renderItem={({ item }) => (
          <Card testID={`monitor-job-${item.id}`} style={styles.jobCard}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.job_title}</Text>
                <Text style={styles.company}>{item.company_name}</Text>
              </View>
              <View style={[styles.statusPill, item.status === 'closed' && styles.closedPill]}>
                <Text style={[styles.statusText, item.status === 'closed' && styles.closedText]}>{item.status}</Text>
              </View>
            </View>
            <Text style={styles.meta}>
              {item.job_type} / {item.location || 'N/A'} / {item.vacancies} vacanc{item.vacancies > 1 ? 'ies' : 'y'}
            </Text>
            <Text style={styles.meta}>Applicants: {item.applicant_count || 0}</Text>
            <Text style={styles.date}>Posted {new Date(item.posted_at).toLocaleDateString()}</Text>
            {item.status !== 'closed' && (
              <View style={{ marginTop: Spacing.md }}>
                <Button
                  testID={`close-job-${item.id}`}
                  title="Close Job"
                  variant="danger"
                  onPress={() => closeJob(item)}
                  loading={busyId === item.id}
                />
              </View>
            )}
          </Card>
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
  headerSub: { color: Colors.cardHighlight, fontSize: FontSize.sm, marginTop: 4 },
  listContent: { padding: Spacing.md, paddingBottom: Spacing.xl },
  jobCard: { borderRadius: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  title: { fontSize: FontSize.md, fontWeight: '900', color: Colors.textDark },
  company: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '800', marginTop: 3 },
  meta: { fontSize: FontSize.sm, color: Colors.gray, marginTop: 5, textTransform: 'capitalize' },
  date: { fontSize: FontSize.xs, color: Colors.gray, marginTop: 7 },
  statusPill: { backgroundColor: Colors.cardHighlight, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  closedPill: { backgroundColor: Colors.muted },
  statusText: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: '900', textTransform: 'uppercase' },
  closedText: { color: Colors.gray },
});
