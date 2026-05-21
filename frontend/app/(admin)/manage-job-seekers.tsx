// ============================================================
// Admin: Manage Job Seekers (deactivate / reactivate)
// ============================================================
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Alert, RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Card, Button, EmptyState, Row } from '../../src/components/ui';
import { api, getApiError } from '../../src/api/client';
import { confirmAction } from '../../src/utils/confirm';
import { Colors, Spacing, FontSize } from '../../src/constants/theme';

export default function ManageJobSeekers() {
  const [seekers, setSeekers] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async () => {
    try {
      const res = await api.get('/admin/job-seekers');
      setSeekers(res.data.job_seekers || []);
    } catch (err) {
      console.warn(getApiError(err));
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const toggleStatus = (seeker: any) => {
    const isActive = seeker.account_status === 'active';
    const action = isActive ? 'deactivate' : 'reactivate';
    confirmAction(
      isActive ? 'Deactivate Account' : 'Reactivate Account',
      isActive
        ? `Deactivate "${seeker.first_name} ${seeker.last_name}"? They will not be able to sign in.`
        : `Reactivate "${seeker.first_name} ${seeker.last_name}"?`,
      async () => {
        setBusyId(seeker.id);
        try {
          await api.put(`/admin/job-seekers/${seeker.id}/${action}`);
          await load();
        } catch (err) {
          Alert.alert('Error', getApiError(err));
        } finally {
          setBusyId(null);
        }
      },
      isActive ? 'Deactivate' : 'Reactivate',
      isActive,
    );
  };

  return (
    <FlatList
      style={styles.container}
      data={seekers}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={{ padding: Spacing.md }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      ListEmptyComponent={<EmptyState message="No job seekers registered yet." />}
      renderItem={({ item }) => {
        const isActive = item.account_status === 'active';
        return (
          <Card testID={`seeker-${item.id}`}>
            <Text style={styles.name}>{item.first_name} {item.last_name}</Text>
            <Text style={styles.subtitle}>{item.email}</Text>
            <View style={{ marginTop: Spacing.sm }}>
              <Row left="Location" right={`${item.city || ''} ${item.province || ''}`} />
              <Row left="Profile Complete" right={item.profile_completed ? 'Yes' : 'No'} />
              <Row left="Account" right={String(item.account_status).toUpperCase()} />
              <Row left="Registered" right={new Date(item.registered_at).toLocaleDateString()} />
            </View>
            <View style={{ marginTop: Spacing.sm }}>
              <Button
                testID={`toggle-${item.id}`}
                title={isActive ? 'Deactivate Account' : 'Reactivate Account'}
                variant={isActive ? 'danger' : 'primary'}
                onPress={() => toggleStatus(item)}
                loading={busyId === item.id}
              />
            </View>
          </Card>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.lightBg },
  name: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textDark },
  subtitle: { fontSize: FontSize.sm, color: Colors.primary, marginTop: 2 },
});
