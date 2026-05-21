// ============================================================
// My Applications - Job Seeker
// ============================================================
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Card, StatusBadge, EmptyState } from '../../src/components/ui';
import { api, getApiError } from '../../src/api/client';
import { Colors, Spacing, FontSize } from '../../src/constants/theme';

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
    <FlatList
      style={styles.container}
      data={apps}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={{ padding: Spacing.md }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      ListEmptyComponent={<EmptyState message="You haven't applied to any jobs yet. Browse jobs to start applying." />}
      renderItem={({ item }) => (
        <TouchableOpacity onPress={() => router.push(`/(seeker)/job/${item.job_post_id}`)} testID={`my-app-${item.id}`}>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.title}>{item.job_title}</Text>
                <Text style={styles.company}>{item.company_name}</Text>
                <Text style={styles.meta}>{item.location} • {item.job_type}</Text>
                <Text style={styles.date}>Applied {new Date(item.applied_at).toLocaleDateString()}</Text>
              </View>
              <StatusBadge status={item.application_status} testID={`status-${item.id}`} />
            </View>
          </Card>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.lightBg },
  title: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark },
  company: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600', marginTop: 2 },
  meta: { fontSize: FontSize.xs, color: Colors.gray, marginTop: 4, textTransform: 'capitalize' },
  date: { fontSize: FontSize.xs, color: Colors.gray, marginTop: 6 },
});
