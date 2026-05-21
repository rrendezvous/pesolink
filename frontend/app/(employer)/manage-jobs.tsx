// ============================================================
// Manage Jobs - Employer
// ============================================================
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Card, Button, EmptyState } from '../../src/components/ui';
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
    <View style={{ flex: 1, backgroundColor: Colors.lightBg }}>
      <View style={{ padding: Spacing.md, paddingBottom: 0 }}>
        <Button testID="new-job-btn" title="+ Create New Job Post" onPress={() => router.push('/(employer)/job-form')} />
      </View>
      <FlatList
        data={jobs}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: Spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={<EmptyState message="No job posts yet. Tap '+ Create New Job Post' to begin." />}
        renderItem={({ item }) => (
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.job_title}</Text>
                <Text style={styles.meta}>{item.job_type} • {item.location || 'N/A'}</Text>
                <Text style={styles.meta}>
                  {item.applicant_count || 0} applicant{item.applicant_count === 1 ? '' : 's'}
                </Text>
                <View style={[styles.statusPill, item.status === 'active' ? { backgroundColor: Colors.accent } : { backgroundColor: Colors.gray }]}>
                  <Text style={{ color: Colors.white, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'capitalize' }}>{item.status}</Text>
                </View>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <View style={{ flex: 1 }}>
                <Button
                  testID={`view-applicants-${item.id}`}
                  title="Applicants"
                  variant="secondary"
                  onPress={() => router.push({ pathname: '/(employer)/applicants', params: { jobId: item.id, jobTitle: item.job_title } })}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  testID={`edit-job-${item.id}`}
                  title="Edit"
                  variant="secondary"
                  onPress={() => router.push({ pathname: '/(employer)/job-form', params: { jobId: item.id } })}
                />
              </View>
              <View style={{ flex: 0.7 }}>
                <Button testID={`delete-job-${item.id}`} title="Delete" variant="danger" onPress={() => deleteJob(item.id)} />
              </View>
            </View>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark },
  meta: { fontSize: FontSize.sm, color: Colors.gray, marginTop: 2, textTransform: 'capitalize' },
  statusPill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginTop: 6 },
});
