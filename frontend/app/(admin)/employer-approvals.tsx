// ============================================================
// Employer Approvals - Admin
// ============================================================
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Card, Button, EmptyState, Row } from '../../src/components/ui';
import { api, getApiError } from '../../src/api/client';
import { Colors, Spacing, FontSize } from '../../src/constants/theme';

export default function EmployerApprovals() {
  const [employers, setEmployers] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async () => {
    try {
      const res = await api.get('/admin/employers/pending');
      setEmployers(res.data.employers || []);
    } catch (err) {
      console.warn(getApiError(err));
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const decide = (emp: any, action: 'approve' | 'reject') => {
    const title = action === 'approve' ? 'Approve Employer' : 'Reject Employer';
    Alert.alert(title, `Are you sure you want to ${action} "${emp.company_name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: action === 'approve' ? 'Approve' : 'Reject',
        style: action === 'reject' ? 'destructive' : 'default',
        onPress: async () => {
          setBusyId(emp.id);
          try {
            await api.put(`/admin/employers/${emp.id}/${action}`);
            await load();
          } catch (err) {
            Alert.alert('Error', getApiError(err));
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  return (
    <FlatList
      style={styles.container}
      data={employers}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={{ padding: Spacing.md }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      ListEmptyComponent={<EmptyState message="No pending employer approvals. Great job!" />}
      renderItem={({ item }) => (
        <Card testID={`pending-emp-${item.id}`}>
          <Text style={styles.companyName}>{item.company_name}</Text>
          <Text style={styles.subtitle}>{item.business_type || 'Business type not specified'}</Text>
          <View style={{ marginTop: Spacing.sm }}>
            <Row left="Email" right={item.email} />
            <Row left="Contact Person" right={item.contact_person || 'N/A'} />
            <Row left="Contact Number" right={item.contact_number || 'N/A'} />
            <Row left="Address" right={item.company_address || 'N/A'} />
            <Row left="Company Size" right={item.company_size || 'N/A'} />
            <Row left="Applied On" right={new Date(item.registered_at).toLocaleDateString()} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: Spacing.md }}>
            <View style={{ flex: 1 }}>
              <Button testID={`approve-${item.id}`} title="Approve" onPress={() => decide(item, 'approve')} loading={busyId === item.id} />
            </View>
            <View style={{ flex: 1 }}>
              <Button testID={`reject-${item.id}`} title="Reject" variant="danger" onPress={() => decide(item, 'reject')} loading={busyId === item.id} />
            </View>
          </View>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.lightBg },
  companyName: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textDark },
  subtitle: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600', marginTop: 2 },
});
