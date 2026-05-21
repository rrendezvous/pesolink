// ============================================================
// Admin: Manage Employers (create, view, legacy approve/reject)
// Employer accounts are created exclusively by PESO Admin.
// ============================================================
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Modal, ScrollView, Alert, RefreshControl,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Card, Button, Input, EmptyState, Row } from '../../src/components/ui';
import { api, getApiError } from '../../src/api/client';
import { confirmAction } from '../../src/utils/confirm';
import { Colors, Spacing, FontSize } from '../../src/constants/theme';

export default function ManageEmployers() {
  const [employers, setEmployers] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    email: '', password: '', company_name: '', company_address: '',
    contact_person: '', contact_number: '', business_type: '', company_size: '',
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await api.get('/admin/employers');
      setEmployers(res.data.employers || []);
    } catch (err) {
      console.warn(getApiError(err));
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const setF = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.email || !form.password || !form.company_name) {
      Alert.alert('Required', 'Email, password, and company name are required.');
      return;
    }
    if (form.password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/admin/employers', form);
      Alert.alert('Created', `Employer account "${form.company_name}" has been created and approved.`);
      setShowForm(false);
      setForm({
        email: '', password: '', company_name: '', company_address: '',
        contact_person: '', contact_number: '', business_type: '', company_size: '',
      });
      await load();
    } catch (err) {
      Alert.alert('Error', getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const legacyDecide = (emp: any, action: 'approve' | 'reject') => {
    confirmAction(
      action === 'approve' ? 'Approve Employer' : 'Reject Employer',
      `Are you sure you want to ${action} "${emp.company_name}"?`,
      async () => {
        try {
          await api.put(`/admin/employers/${emp.id}/${action}`);
          await load();
        } catch (err) {
          Alert.alert('Error', getApiError(err));
        }
      },
      action === 'approve' ? 'Approve' : 'Reject',
      action === 'reject',
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.lightBg }}>
      <View style={{ padding: Spacing.md, paddingBottom: 0 }}>
        <Button testID="new-employer-btn" title="+ Create Employer Account" onPress={() => setShowForm(true)} />
      </View>
      <FlatList
        data={employers}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: Spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={<EmptyState message="No employers in the system yet." />}
        renderItem={({ item }) => (
          <Card testID={`emp-${item.id}`}>
            <Text style={styles.companyName}>{item.company_name}</Text>
            <Text style={styles.subtitle}>{item.business_type || 'Business type not specified'}</Text>
            <View style={{ marginTop: Spacing.sm }}>
              <Row left="Email" right={item.email} />
              <Row left="Contact Person" right={item.contact_person || 'N/A'} />
              <Row left="Contact" right={item.contact_number || 'N/A'} />
              <Row left="Approval" right={item.approval_status} />
              <Row left="Account" right={item.account_status} />
            </View>
            {item.approval_status === 'pending' && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: Spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Button testID={`legacy-approve-${item.id}`} title="Approve (legacy)" onPress={() => legacyDecide(item, 'approve')} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button testID={`legacy-reject-${item.id}`} title="Reject (legacy)" variant="danger" onPress={() => legacyDecide(item, 'reject')} />
                </View>
              </View>
            )}
          </Card>
        )}
      />

      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBg}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Create Employer Account</Text>
              <Text style={styles.modalSub}>This account will be active and approved immediately.</Text>
              <Input testID="emp-email" label="Email *" value={form.email} onChangeText={(v) => setF('email', v)} keyboardType="email-address" />
              <Input testID="emp-password" label="Initial Password (min 6 chars) *" value={form.password} onChangeText={(v) => setF('password', v)} secureTextEntry />
              <Input testID="emp-company" label="Company Name *" value={form.company_name} onChangeText={(v) => setF('company_name', v)} autoCapitalize="words" />
              <Input testID="emp-address" label="Company Address" value={form.company_address} onChangeText={(v) => setF('company_address', v)} multiline numberOfLines={2} />
              <Input testID="emp-person" label="Contact Person" value={form.contact_person} onChangeText={(v) => setF('contact_person', v)} autoCapitalize="words" />
              <Input testID="emp-contact" label="Contact Number" value={form.contact_number} onChangeText={(v) => setF('contact_number', v)} keyboardType="phone-pad" />
              <Input testID="emp-biz" label="Business Type" value={form.business_type} onChangeText={(v) => setF('business_type', v)} autoCapitalize="words" />
              <Input testID="emp-size" label="Company Size (small / medium / large)" value={form.company_size} onChangeText={(v) => setF('company_size', v.toLowerCase())} />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: Spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Button testID="emp-cancel" title="Cancel" variant="secondary" onPress={() => setShowForm(false)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button testID="emp-create" title="Create Account" onPress={submit} loading={saving} />
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  companyName: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textDark },
  subtitle: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600', marginTop: 2 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.md, maxHeight: '90%' },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textDark },
  modalSub: { fontSize: FontSize.sm, color: Colors.gray, marginBottom: Spacing.sm },
});
