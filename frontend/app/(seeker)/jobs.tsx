// ============================================================
// Job Browse + Search/Filter (combined)
// ============================================================
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, FlatList,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Input, Card, EmptyState, Chip } from '../../src/components/ui';
import { api, getApiError } from '../../src/api/client';
import { Colors, Spacing, FontSize } from '../../src/constants/theme';

const JOB_TYPES = ['full-time', 'part-time', 'contract', 'temporary'];

export default function JobBrowse() {
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const params: any = {};
      if (search) params.search = search;
      if (typeFilter) params.job_type = typeFilter;
      const res = await api.get('/jobs', { params });
      setJobs(res.data.jobs || []);
    } catch (err) {
      console.warn(getApiError(err));
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [search, typeFilter]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.container} testID="job-browse">
      <View style={styles.filterBar}>
        <Input
          testID="job-search"
          value={search}
          onChangeText={setSearch}
          placeholder="Search jobs by title, company or keyword..."
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <Chip testID="filter-all" label="All Types" active={!typeFilter} onPress={() => setTypeFilter('')} />
          {JOB_TYPES.map((t) => (
            <Chip key={t} testID={`filter-${t}`} label={t} active={typeFilter === t} onPress={() => setTypeFilter(t)} />
          ))}
        </View>
      </View>

      <FlatList
        data={jobs}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: Spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={<EmptyState message="No jobs found. Try a different search or filter." />}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`/(seeker)/job/${item.id}`)} testID={`job-${item.id}`} activeOpacity={0.85}>
            <Card>
              <Text style={styles.jobTitle}>{item.job_title}</Text>
              <Text style={styles.jobCompany}>{item.company_name}</Text>
              <View style={{ flexDirection: 'row', marginTop: 8, flexWrap: 'wrap', gap: 6 }}>
                <MetaPill label={item.job_type} />
                {item.location && <MetaPill label={item.location} />}
                {item.salary_min && item.salary_max && (
                  <MetaPill label={`₱${Number(item.salary_min).toLocaleString()} - ₱${Number(item.salary_max).toLocaleString()}`} />
                )}
              </View>
              <Text style={styles.jobDesc} numberOfLines={2}>{item.job_description}</Text>
            </Card>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function MetaPill({ label }: { label: string }) {
  return (
    <View style={{ backgroundColor: Colors.surface, borderColor: Colors.border, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
      <Text style={{ color: Colors.textDark, fontSize: FontSize.xs, textTransform: 'capitalize' }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.lightBg },
  filterBar: { padding: Spacing.md, paddingBottom: 0, backgroundColor: Colors.lightBg },
  jobTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textDark },
  jobCompany: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600', marginTop: 2 },
  jobDesc: { color: Colors.gray, fontSize: FontSize.sm, marginTop: 8, lineHeight: 18 },
});
