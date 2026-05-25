// ============================================================
// My Applications - Job Seeker
// ============================================================
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { StatusBadge, EmptyState } from '../../src/components/ui';
import { api, getApiError } from '../../src/api/client';
import { Colors, Spacing, FontSize, Radius, Shadow } from '../../src/constants/theme';

export default function MyApplications() {
  const router = useRouter();
  const [apps, setApps] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await api.get('/applications/my-applications');
      setApps(res.data.applications || []);
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.kicker}>PESO-Link MisOr</Text>
        <Text style={styles.headerTitle}>Application Status</Text>
      </View>

      <FlatList
        data={apps}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={<EmptyState message="You haven't applied to any jobs yet. Browse jobs to start applying." />}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`/(seeker)/job/${item.job_post_id}`)} testID={`my-app-${item.id}`} activeOpacity={0.85} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.companyMark}>
                <Text style={styles.companyMarkText}>{(item.company_name || 'P').charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.title}>{item.job_title}</Text>
                <Text style={styles.company}>{item.company_name}</Text>
                <Text style={styles.meta}>{item.location} / {item.job_type}</Text>
              </View>
              <StatusBadge status={item.application_status} testID={`status-${item.id}`} />
            </View>
            <View style={styles.statusPanel}>
              <Text style={styles.statusLabel}>Application Status</Text>
              <Text style={styles.date}>Applied {new Date(item.applied_at).toLocaleDateString()}</Text>
            </View>
          </TouchableOpacity>
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
  listContent: { padding: Spacing.md, paddingBottom: Spacing.xl },
  card: {
    backgroundColor: Colors.white,
    borderColor: Colors.borderSoft,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.card,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  companyMark: {
    width: 56, height: 56, borderRadius: Radius.md,
    backgroundColor: Colors.cardHighlight,
    alignItems: 'center', justifyContent: 'center',
    marginRight: Spacing.md,
  },
  companyMarkText: { color: Colors.primary, fontSize: FontSize.xl, fontWeight: '900' },
  title: { fontSize: FontSize.md, fontWeight: '900', color: Colors.textDark },
  company: { fontSize: FontSize.sm, color: Colors.gray, fontWeight: '700', marginTop: 2 },
  meta: { fontSize: FontSize.xs, color: Colors.gray, marginTop: 4, textTransform: 'capitalize' },
  statusPanel: {
    backgroundColor: Colors.cardHighlight,
    borderColor: Colors.borderSoft,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginTop: Spacing.md,
  },
  statusLabel: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: '900' },
  date: { fontSize: FontSize.xs, color: Colors.gray, marginTop: 4 },
});
