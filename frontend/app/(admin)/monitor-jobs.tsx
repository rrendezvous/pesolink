// ============================================================
// Monitor Jobs - Admin (search, status filter, soft-close action)
// ============================================================
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Alert, ScrollView } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Card, Button, EmptyState, BackLink, Input, Chip } from '../../src/components/ui';
import { formatDate } from '../../src/components/NsrpProfileView';
import { api, getApiError } from '../../src/api/client';
import { confirmAction } from '../../src/utils/confirm';
import { jobState, JobState, JOB_STATE_LABELS } from '../../src/utils/jobs';
import { Colors, Spacing, FontSize, Radius, StatusColors } from '../../src/constants/theme';

const FILTERS: { key: '' | JobState; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'expired', label: 'Expired' },
  { key: 'closed', label: 'Closed' },
];

export default function MonitorJobs() {
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'' | JobState>('');

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
      `Close "${job.job_title}"?`,
      'The job post will stop accepting applications and leave the job list. Applicants still in progress will be marked Closed '
        + 'and notified (not a rejection); hired applicants stay Hired. The record is kept for monitoring.',
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

  const term = search.trim().toLowerCase();
  const matchesSearch = (j: any) => !term
    || [j.job_title, j.company_name, j.location].some((v) => String(v || '').toLowerCase().includes(term));
  const searched = jobs.filter(matchesSearch);
  const countFor = (key: '' | JobState) => (key ? searched.filter((j) => jobState(j) === key).length : searched.length);
  const visible = filter ? searched.filter((j) => jobState(j) === filter) : searched;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackLink testID="back-home" label="Home" onPress={() => router.navigate('/(admin)/dashboard')} />
        <Text style={styles.kicker}>PESO-Link MisOr</Text>
        <Text style={styles.headerTitle}>Job Posts</Text>
        <Text style={styles.headerSub}>Monitor employer postings and soft-close when needed</Text>
      </View>
      <FlatList
        data={visible}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListHeaderComponent={
          <View style={styles.filters}>
            <Input
              testID="admin-job-search"
              value={search}
              onChangeText={setSearch}
              placeholder="Search job title, company, or location"
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {FILTERS.map((f) => (
                <Chip
                  key={f.key || 'all'}
                  testID={`admin-job-filter-${f.key || 'all'}`}
                  label={`${f.label} (${countFor(f.key)})`}
                  active={filter === f.key}
                  onPress={() => setFilter(f.key)}
                />
              ))}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          <EmptyState message={jobs.length ? 'No job posts match this search or filter.' : 'No job posts in the system yet.'} />
        }
        renderItem={({ item }) => {
          const state = jobState(item);
          return (
            <Card testID={`monitor-job-${item.id}`} style={styles.jobCard}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{item.job_title}</Text>
                  <Text style={styles.company}>{item.company_name}</Text>
                </View>
                <View style={[styles.statusPill, state === 'expired' && styles.expiredPill, state === 'closed' && styles.closedPill]}>
                  <Text
                    testID={`monitor-job-state-${item.id}`}
                    style={[styles.statusText, state === 'expired' && styles.expiredText, state === 'closed' && styles.closedText]}
                  >
                    {JOB_STATE_LABELS[state]}
                  </Text>
                </View>
              </View>
              <Text style={styles.meta}>
                {item.job_type} / {item.location || 'N/A'} / {item.vacancies} vacanc{item.vacancies > 1 ? 'ies' : 'y'}
              </Text>
              <Text style={styles.meta}>Applicants: {item.applicant_count || 0}</Text>
              <Text style={styles.date}>
                Posted {new Date(item.posted_at).toLocaleDateString()}
                {item.closing_date ? ` / Closing date ${formatDate(item.closing_date)}` : ''}
              </Text>
              {state === 'expired' && (
                <Text style={styles.expiredNote}>
                  The closing date has passed, so job seekers no longer see this post and can&apos;t apply.
                </Text>
              )}
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
          );
        }}
      />
    </View>
  );
}

const amber = StatusColors.needs_revision;

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
  filters: { marginBottom: Spacing.sm },
  jobCard: { borderRadius: Radius.lg },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  title: { fontSize: FontSize.md, fontWeight: '900', color: Colors.textDark },
  company: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '800', marginTop: 3 },
  meta: { fontSize: FontSize.sm, color: Colors.gray, marginTop: 5, textTransform: 'capitalize' },
  date: { fontSize: FontSize.xs, color: Colors.gray, marginTop: 7 },
  statusPill: { backgroundColor: Colors.cardHighlight, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  expiredPill: { backgroundColor: amber.bg },
  closedPill: { backgroundColor: Colors.muted },
  statusText: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: '900', textTransform: 'uppercase' },
  expiredText: { color: amber.text },
  closedText: { color: Colors.gray },
  expiredNote: { color: amber.text, fontSize: FontSize.xs, lineHeight: 18, marginTop: Spacing.sm },
});
