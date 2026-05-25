// ============================================================
// Monitor Applications - Admin (read-only)
// ============================================================
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Card, StatusBadge, EmptyState } from '../../src/components/ui';
import { api, getApiError } from '../../src/api/client';
import { Colors, Spacing, FontSize, Radius } from '../../src/constants/theme';

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

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.kicker}>PESO-Link MisOr</Text>
        <Text style={styles.headerTitle}>Applications</Text>
        <Text style={styles.headerSub}>Read-only tracking across employer job posts</Text>
      </View>
      <FlatList
        data={apps}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={<EmptyState message="No applications recorded yet." />}
        renderItem={({ item }) => (
          <Card style={styles.appCard}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.applicant}>{item.first_name} {item.last_name}</Text>
                <Text style={styles.company}>Applied for {item.job_title}</Text>
                <Text style={styles.detail}>{item.company_name}</Text>
                <Text style={styles.date}>Applied {new Date(item.applied_at).toLocaleDateString()}</Text>
              </View>
              <StatusBadge status={item.application_status} />
            </View>
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
  appCard: { borderRadius: Radius.lg },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.sm },
  applicant: { fontSize: FontSize.md, fontWeight: '900', color: Colors.textDark },
  company: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '800', marginTop: 3 },
  detail: { fontSize: FontSize.sm, color: Colors.gray, marginTop: 3 },
  date: { fontSize: FontSize.xs, color: Colors.gray, marginTop: 6 },
});
