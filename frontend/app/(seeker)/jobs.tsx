// ============================================================
// Job Browse + Search/Filter (combined)
// ============================================================
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, RefreshControl, FlatList,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Input, EmptyState, Chip } from '../../src/components/ui';
import { api, getApiError } from '../../src/api/client';
import { Colors, Spacing, FontSize, Radius, Shadow } from '../../src/constants/theme';

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
      <View style={styles.header}>
        <Text style={styles.kicker}>PESO-Link MisOr</Text>
        <Text style={styles.headerTitle}>Jobs</Text>
      </View>

      <View style={styles.filterCard}>
        <Input
          testID="job-search"
          value={search}
          onChangeText={setSearch}
          placeholder="Search job title, company, or keyword"
        />
        <View style={styles.filterChips}>
          <Chip testID="filter-all" label="All Types" active={!typeFilter} onPress={() => setTypeFilter('')} />
          {JOB_TYPES.map((t) => (
            <Chip key={t} testID={`filter-${t}`} label={t} active={typeFilter === t} onPress={() => setTypeFilter(t)} />
          ))}
        </View>
      </View>

      <FlatList
        data={jobs}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={<EmptyState message="No jobs found. Try a different search or filter." />}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`/(seeker)/job/${item.id}`)} testID={`job-${item.id}`} activeOpacity={0.85} style={styles.jobCard}>
            <View style={styles.companyMark}>
              <Text style={styles.companyMarkText}>{(item.company_name || 'P').charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.jobBody}>
              <Text style={styles.jobTitle}>{item.job_title}</Text>
              <Text style={styles.jobCompany}>{item.company_name}</Text>
              <View style={styles.metaRow}>
                <MetaPill label={item.job_type} />
                {item.location && <MetaPill label={item.location} />}
              </View>
              <Text style={styles.jobDesc} numberOfLines={2}>{item.job_description}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function MetaPill({ label }: { label: string }) {
  return (
    <View style={styles.metaPill}>
      <Text style={styles.metaPillText}>{label}</Text>
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
  filterCard: {
    backgroundColor: Colors.white,
    borderColor: Colors.borderSoft,
    borderWidth: 1,
    borderRadius: Radius.lg,
    margin: Spacing.md,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    ...Shadow.card,
  },
  filterChips: { flexDirection: 'row', flexWrap: 'wrap' },
  listContent: { padding: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.xl },
  jobCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderColor: Colors.borderSoft,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.card,
  },
  companyMark: {
    width: 60, height: 60, borderRadius: Radius.md,
    backgroundColor: Colors.cardHighlight,
    alignItems: 'center', justifyContent: 'center',
    marginRight: Spacing.md,
  },
  companyMarkText: { color: Colors.primary, fontSize: FontSize.xl, fontWeight: '900' },
  jobBody: { flex: 1 },
  jobTitle: { fontSize: FontSize.lg, fontWeight: '900', color: Colors.textDark },
  jobCompany: { fontSize: FontSize.sm, color: Colors.gray, fontWeight: '700', marginTop: 2 },
  metaRow: { flexDirection: 'row', marginTop: 10, flexWrap: 'wrap', gap: 6 },
  metaPill: {
    backgroundColor: Colors.muted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  metaPillText: { color: Colors.textDark, fontSize: FontSize.xs, textTransform: 'capitalize', fontWeight: '700' },
  jobDesc: { color: Colors.gray, fontSize: FontSize.sm, marginTop: 10, lineHeight: 18 },
});
