// ============================================================
// Monitor Applications - Admin (read-only)
// ============================================================
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Card, StatusBadge, EmptyState } from '../../src/components/ui';
import { api, getApiError } from '../../src/api/client';
import { Colors, Spacing, FontSize } from '../../src/constants/theme';

export default function MonitorApps() {
  const [apps, setApps] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await api.get('/admin/applications');
      setApps(res.data.applications || []);
    } catch (err) {
      console.warn(getApiError(err));
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <FlatList
      style={styles.container}
      data={apps}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={{ padding: Spacing.md }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      ListEmptyComponent={<EmptyState message="No applications recorded yet." />}
      renderItem={({ item }) => (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.applicant}>{item.first_name} {item.last_name}</Text>
              <Text style={styles.company}>applied for {item.job_title}</Text>
              <Text style={styles.detail}>{item.company_name}</Text>
              <Text style={styles.date}>{new Date(item.applied_at).toLocaleDateString()}</Text>
            </View>
            <StatusBadge status={item.application_status} />
          </View>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.lightBg },
  applicant: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark },
  company: { fontSize: FontSize.sm, color: Colors.primary, marginTop: 2 },
  detail: { fontSize: FontSize.xs, color: Colors.gray, marginTop: 2 },
  date: { fontSize: FontSize.xs, color: Colors.gray, marginTop: 4 },
});
