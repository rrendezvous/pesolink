// ============================================================
// Admin: Manage Employers (create, approve, update, deactivate / reactivate)
// Employer accounts are created exclusively by PESO Admin (§3.5.3).
// ============================================================
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Modal, ScrollView, Alert, RefreshControl,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Card, Button, Input, EmptyState, Row, Chip, BackLink } from '../../src/components/ui';
import { api, getApiError } from '../../src/api/client';
import { confirmAction } from '../../src/utils/confirm';
import { Colors, Spacing, FontSize, Radius, Shadow } from '../../src/constants/theme';

const EMPTY_FORM = {
  email: '', password: '', company_name: '', company_address: '',
  contact_person: '', contact_number: '', business_type: '', company_size: '',
};

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending Approval' },
  { key: 'active', label: 'Active' },
  { key: 'deactivated', label: 'Deactivated' },
];

// Where an employer account stands, combining PESO approval and account status.
function accountState(emp: any): 'pending' | 'rejected' | 'active' | 'deactivated' {
  if (emp.approval_status === 'pending') return 'pending';
  if (emp.approval_status === 'rejected') return 'rejected';
  return emp.account_status === 'active' ? 'active' : 'deactivated';
}

const STATE_LABELS = {
  pending: 'Pending Approval', rejected: 'Rejected', active: 'Active', deactivated: 'Deactivated',
};

export default function ManageEmployers() {
  const router = useRouter();
  const [employers, setEmployers] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<any | null>(null); // null = closed, {} = create, employer = edit
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

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
  const isCreate = editing && !editing.id;

  const openCreate = () => { setForm(EMPTY_FORM); setEditing({}); };
  const openEdit = (emp: any) => {
    setForm({
      ...EMPTY_FORM,
      company_name: emp.company_name || '',
      company_address: emp.company_address || '',
      contact_person: emp.contact_person || '',
      contact_number: emp.contact_number || '',
      business_type: emp.business_type || '',
      company_size: emp.company_size || '',
    });
    setEditing(emp);
  };

  const submit = async () => {
    if (!form.company_name.trim() || (isCreate && (!form.email || !form.password))) {
      Alert.alert('Required', isCreate ? 'Email, password, and company name are required.' : 'Company name is required.');
      return;
    }
    if (isCreate && form.password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }
    if (form.company_size && !['small', 'medium', 'large'].includes(form.company_size)) {
      Alert.alert('Company Size', 'Use small, medium, or large, or leave it blank.');
      return;
    }
    setSaving(true);
    try {
      if (isCreate) {
        await api.post('/admin/employers', form);
        Alert.alert('Created', `Employer account "${form.company_name}" has been created and approved.`);
      } else {
        const { email, password, ...details } = form;
        await api.put(`/admin/employers/${editing.id}`, details);
        Alert.alert('Saved', `"${form.company_name}" was updated. The employer has been notified.`);
      }
      setEditing(null);
      await load();
    } catch (err) {
      Alert.alert('Error', getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const act = (emp: any, action: 'approve' | 'reject' | 'deactivate' | 'reactivate') => {
    const copy = {
      approve: ['Approve Employer', `Approve "${emp.company_name}"? They can sign in and post jobs.`, 'Approve', false],
      reject: ['Reject Employer', `Reject "${emp.company_name}"? They will not be able to sign in.`, 'Reject', true],
      deactivate: ['Deactivate Employer', `Deactivate "${emp.company_name}"? They can no longer sign in, their active job posts are closed, and those applicants are notified.`, 'Deactivate', true],
      reactivate: ['Reactivate Employer', `Reactivate "${emp.company_name}"? Job posts closed during deactivation stay closed.`, 'Reactivate', false],
    }[action] as [string, string, string, boolean];
    confirmAction(copy[0], copy[1], async () => {
      setBusyId(emp.id);
      try {
        const res = await api.put(`/admin/employers/${emp.id}/${action}`);
        await load();
        if (action === 'deactivate' && res.data.closed_job_posts) {
          Alert.alert('Deactivated', `${res.data.closed_job_posts} active job post(s) were closed.`);
        }
      } catch (err) {
        Alert.alert('Error', getApiError(err));
      } finally {
        setBusyId(null);
      }
    }, copy[2], copy[3]);
  };

  const countFor = (key: string) => (key ? employers.filter((e) => accountState(e) === key).length : employers.length);
  const visible = employers.filter((e) => !filter || accountState(e) === filter);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackLink testID="back-home" label="Home" onPress={() => router.navigate('/(admin)/dashboard')} />
        <Text style={styles.kicker}>PESO-Link MisOr</Text>
        <Text style={styles.headerTitle}>Employers</Text>
        <Text style={styles.headerSub}>Employer accounts under PESO administrative control</Text>
      </View>
      <View style={styles.topBar}>
        <Button testID="new-employer-btn" title="+ Create Employer Account" onPress={openCreate} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: Spacing.sm }}>
          {FILTERS.map((f) => (
            <Chip
              key={f.key || 'all'}
              testID={`emp-filter-${f.key || 'all'}`}
              label={`${f.label} (${countFor(f.key)})`}
              active={filter === f.key}
              onPress={() => setFilter(f.key)}
            />
          ))}
        </ScrollView>
      </View>
      <FlatList
        data={visible}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={<EmptyState message={employers.length ? 'No employers match this filter.' : 'No employers in the system yet.'} />}
        renderItem={({ item }) => {
          const state = accountState(item);
          const busy = busyId === item.id;
          return (
            <Card testID={`emp-${item.id}`} style={state === 'pending' ? { ...styles.employerCard, ...styles.employerCardPending } : styles.employerCard}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.companyName}>{item.company_name}</Text>
                  <Text style={styles.subtitle}>{item.business_type || 'Business type not specified'}</Text>
                </View>
                <View style={[styles.pill, state === 'active' ? styles.pillActive : styles.pillMuted]}>
                  <Text style={[styles.pillText, state === 'active' && { color: Colors.white }]}>{STATE_LABELS[state]}</Text>
                </View>
              </View>
              <View style={{ marginTop: Spacing.sm }}>
                <Row left="Email" right={item.email} />
                <Row left="Contact Person" right={item.contact_person || 'N/A'} />
                <Row left="Contact" right={item.contact_number || 'N/A'} />
                <Row left="Address" right={item.company_address || 'N/A'} />
              </View>
              <View style={styles.actions}>
                {state === 'pending' && (
                  <>
                    <View style={{ flex: 1 }}><Button testID={`approve-${item.id}`} title="Approve" onPress={() => act(item, 'approve')} loading={busy} /></View>
                    <View style={{ flex: 1 }}><Button testID={`reject-${item.id}`} title="Reject" variant="danger" onPress={() => act(item, 'reject')} loading={busy} /></View>
                  </>
                )}
                {state === 'active' && (
                  <>
                    <View style={{ flex: 1 }}><Button testID={`edit-emp-${item.id}`} title="Edit Details" variant="secondary" onPress={() => openEdit(item)} /></View>
                    <View style={{ flex: 1 }}><Button testID={`deactivate-emp-${item.id}`} title="Deactivate" variant="danger" onPress={() => act(item, 'deactivate')} loading={busy} /></View>
                  </>
                )}
                {state === 'rejected' && (
                  <View style={{ flex: 1 }}><Button testID={`approve-${item.id}`} title="Approve After All" variant="secondary" onPress={() => act(item, 'approve')} loading={busy} /></View>
                )}
                {state === 'deactivated' && (
                  <View style={{ flex: 1 }}><Button testID={`reactivate-emp-${item.id}`} title="Reactivate" variant="secondary" onPress={() => act(item, 'reactivate')} loading={busy} /></View>
                )}
              </View>
            </Card>
          );
        }}
      />

      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBg}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{isCreate ? 'Create Employer Account' : 'Edit Employer Details'}</Text>
              <Text style={styles.modalSub}>
                {isCreate ? 'This account will be active and approved immediately.' : 'The employer is notified that PESO updated their details.'}
              </Text>
              {isCreate && (
                <>
                  <Input testID="emp-email" label="Email *" value={form.email} onChangeText={(v) => setF('email', v)} keyboardType="email-address" />
                  <Input testID="emp-password" label="Initial Password (min 6 chars) *" value={form.password} onChangeText={(v) => setF('password', v)} secureTextEntry />
                </>
              )}
              <Input testID="emp-company" label="Company Name *" value={form.company_name} onChangeText={(v) => setF('company_name', v)} autoCapitalize="words" />
              <Input testID="emp-address" label="Company Address" value={form.company_address} onChangeText={(v) => setF('company_address', v)} multiline numberOfLines={2} />
              <Input testID="emp-person" label="Contact Person" value={form.contact_person} onChangeText={(v) => setF('contact_person', v)} autoCapitalize="words" />
              <Input testID="emp-contact" label="Contact Number" value={form.contact_number} onChangeText={(v) => setF('contact_number', v)} keyboardType="phone-pad" />
              <Input testID="emp-biz" label="Business Type" value={form.business_type} onChangeText={(v) => setF('business_type', v)} autoCapitalize="words" />
              <Input testID="emp-size" label="Company Size (small / medium / large)" value={form.company_size} onChangeText={(v) => setF('company_size', v.toLowerCase().trim())} />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: Spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Button testID="emp-cancel" title="Cancel" variant="secondary" onPress={() => setEditing(null)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button testID="emp-create" title={isCreate ? 'Create Account' : 'Save'} onPress={submit} loading={saving} />
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
  topBar: { padding: Spacing.md, paddingBottom: Spacing.xs },
  listContent: { padding: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.xl },
  employerCard: { borderRadius: Radius.lg },
  employerCardPending: { borderColor: Colors.warning },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  companyName: { fontSize: FontSize.lg, fontWeight: '900', color: Colors.textDark },
  subtitle: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '800', marginTop: 2 },
  pill: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  pillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pillMuted: { backgroundColor: '#FEF3C7', borderColor: Colors.warning },
  pillText: { color: Colors.textDark, fontSize: FontSize.xs, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    maxHeight: '90%',
    ...Shadow.raised,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '900', color: Colors.textDark },
  modalSub: { fontSize: FontSize.sm, color: Colors.gray, marginBottom: Spacing.sm },
});
