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
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const closeJob = (job: any) => {
    confirmAction(
      'Close Job Post',
      `Close "${job.job_title}"? This is a soft removal — the record is retained for monitoring and audit.`,
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
    <FlatList
      style={styles.container}
      data={jobs}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={{ padding: Spacing.md }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      ListEmptyComponent={<EmptyState message="No job posts in the system yet." />}
      renderItem={({ item }) => (
        <Card testID={`monitor-job-${item.id}`}>
          <Text style={styles.title}>{item.job_title}</Text>
          <Text style={styles.company}>{item.company_name}</Text>
          <Text style={styles.meta}>
            {item.job_type} • {item.location || 'N/A'} • {item.vacancies} vacanc{item.vacancies > 1 ? 'ies' : 'y'}
          </Text>
          <Text style={styles.meta}>
            Status: <Text style={{ fontWeight: '700', color: item.status === 'closed' ? Colors.gray : Colors.primary }}>
              {String(item.status).toUpperCase()}
            </Text> • Applicants: {item.applicant_count || 0}
          </Text>
          <Text style={styles.date}>Posted {new Date(item.posted_at).toLocaleDateString()}</Text>
          {item.status !== 'closed' && (
            <View style={{ marginTop: Spacing.sm }}>
              <Button
                testID={`close-job-${item.id}`}
                title="Close Job (Soft Removal)"
                variant="danger"
                onPress={() => closeJob(item)}
                loading={busyId === item.id}
              />
            </View>
          )}
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.lightBg },
  title: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark },
  company: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600', marginTop: 2 },
  meta: { fontSize: FontSize.sm, color: Colors.gray, marginTop: 4, textTransform: 'capitalize' },
  date: { fontSize: FontSize.xs, color: Colors.gray, marginTop: 6 },
});
