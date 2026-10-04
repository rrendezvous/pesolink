// ============================================================
// Admin: Job Seekers (monitor NSRP profiles, deactivate / reactivate accounts)
// Referral decisions are made per job on the Referrals screen.
// ============================================================
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Alert, RefreshControl, Modal, ScrollView, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Card, Button, EmptyState, Row, Chip, StatusBadge } from '../../src/components/ui';
import { NsrpProfileView, NsrpRequirements, Section } from '../../src/components/NsrpProfileView';
import { api, getApiError } from '../../src/api/client';
import { confirmAction } from '../../src/utils/confirm';
import { currentStatus } from '../../src/utils/referral';
import { Colors, Spacing, FontSize, Radius, Shadow } from '../../src/constants/theme';

const PROFILE_FILTERS = [
  { key: '', label: 'All' },
  { key: 'complete', label: 'NSRP Complete' },
  { key: 'incomplete', label: 'Incomplete' },
];

export default function ManageJobSeekers() {
  const [seekers, setSeekers] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [filter, setFilter] = useState('');
  const [detail, setDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

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

  const openProfile = async (seeker: any) => {
    setDetail({ profile: seeker });
    setDetailLoading(true);
    try {
      const res = await api.get(`/admin/job-seekers/${seeker.id}/profile`);
      setDetail(res.data);
    } catch (err) {
      Alert.alert('Error', getApiError(err));
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const toggleStatus = (seeker: any) => {
    const isActive = seeker.account_status === 'active';
    const action = isActive ? 'deactivate' : 'reactivate';
    confirmAction(
      isActive ? 'Deactivate Account' : 'Reactivate Account',
      isActive
        ? `Deactivate "${seeker.first_name} ${seeker.last_name}"? Use this for incomplete, invalid, or inappropriate information. They will not be able to sign in.`
        : `Reactivate "${seeker.first_name} ${seeker.last_name}"?`,
      async () => {
        setBusyId(seeker.id);
        try {
          await api.put(`/admin/job-seekers/${seeker.id}/${action}`);
          setDetail(null);
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

  const visibleSeekers = seekers.filter((s) => {
    if (filter === 'complete') return !!s.profile_completed;
    if (filter === 'incomplete') return !s.profile_completed;
    return true;
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.kicker}>PESO-Link MisOr</Text>
        <Text style={styles.headerTitle}>Job Seekers</Text>
        <Text style={styles.headerSub}>Monitor NSRP-based profiles and job seeker accounts</Text>
      </View>
      <FlatList
        data={visibleSeekers}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListHeaderComponent={(
          <View style={styles.filterRow}>
            {PROFILE_FILTERS.map((f) => (
              <Chip
                key={f.key || 'all'}
                testID={`seeker-filter-${f.key || 'all'}`}
                label={f.label}
                active={filter === f.key}
                onPress={() => setFilter(f.key)}
              />
            ))}
          </View>
        )}
        ListEmptyComponent={<EmptyState message={filter ? 'No job seekers match this filter.' : 'No job seekers registered yet.'} />}
        renderItem={({ item }) => {
          const isActive = item.account_status === 'active';
          return (
            <Card testID={`seeker-${item.id}`} style={styles.seekerCard}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.first_name} {item.last_name}</Text>
                  <Text style={styles.subtitle}>{item.email}</Text>
                </View>
                <ProfilePill complete={!!item.profile_completed} />
              </View>
              <View style={{ marginTop: Spacing.sm }}>
                <Row left="Location" right={`${item.city || ''} ${item.province || ''}`.trim() || 'N/A'} />
                <Row left="NSRP Profile" right={item.profile_completed ? 'Complete' : 'Incomplete'} />
                <Row left="Account" right={String(item.account_status).toUpperCase()} />
                <Row left="Registered" right={new Date(item.registered_at).toLocaleDateString()} />
              </View>
              <View style={{ marginTop: Spacing.sm }}>
                <Button testID={`view-profile-${item.id}`} title="View NSRP Profile" onPress={() => openProfile(item)} />
              </View>
              <View style={{ marginTop: Spacing.sm }}>
                <Button
                  testID={`toggle-${item.id}`}
                  title={isActive ? 'Deactivate Account' : 'Reactivate Account'}
                  variant={isActive ? 'danger' : 'secondary'}
                  onPress={() => toggleStatus(item)}
                  loading={busyId === item.id}
                />
              </View>
            </Card>
          );
        }}
      />

      <Modal visible={!!detail} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            {detail && (
              <ScrollView>
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>
                      {[detail.profile?.first_name, detail.profile?.middle_name, detail.profile?.last_name, detail.profile?.nsrp_full_data?.suffix]
                        .filter(Boolean).join(' ') || 'Job Seeker'}
                    </Text>
                    <Text style={styles.modalSubtle}>{detail.profile?.email}</Text>
                  </View>
                  <ProfilePill complete={!!detail.profile?.profile_completed} />
                </View>

                {detailLoading ? (
                  <ActivityIndicator color={Colors.primary} style={{ marginVertical: Spacing.xl }} />
                ) : (
                  <>
                    <NsrpRequirements requirements={detail.referral_requirements} />
                    <NsrpProfileView profile={detail.profile} skills={detail.skills || []} />
                    <Section title={`Referral Requests (${(detail.applications || []).length})`}>
                      {(detail.applications || []).length ? detail.applications.map((a: any) => (
                        <View key={a.id} style={styles.appRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.appTitle}>{a.job_title}</Text>
                            <Text style={styles.appMeta}>{a.company_name} / {new Date(a.applied_at).toLocaleDateString()}</Text>
                          </View>
                          <StatusBadge status={currentStatus(a).status} />
                        </View>
                      )) : <Text style={styles.emptyText}>No referral requests yet.</Text>}
                    </Section>
                  </>
                )}

                <View style={{ marginTop: Spacing.md }}>
                  <Button testID="close-profile" title="Close" variant="secondary" onPress={() => setDetail(null)} />
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ProfilePill({ complete }: { complete: boolean }) {
  return (
    <View style={[styles.pill, complete ? styles.pillComplete : styles.pillIncomplete]}>
      <Text style={[styles.pillText, complete && { color: Colors.white }]}>{complete ? 'Complete' : 'Incomplete'}</Text>
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
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: Spacing.sm },
  seekerCard: { borderRadius: Radius.lg },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  name: { fontSize: FontSize.lg, fontWeight: '900', color: Colors.textDark },
  subtitle: { fontSize: FontSize.sm, color: Colors.primary, marginTop: 2 },
  pill: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  pillComplete: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pillIncomplete: { backgroundColor: '#FEF3C7', borderColor: Colors.warning },
  pillText: { color: Colors.textDark, fontSize: FontSize.xs, fontWeight: '900' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    maxHeight: '92%',
    ...Shadow.raised,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.sm },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '900', color: Colors.textDark },
  modalSubtle: { fontSize: FontSize.sm, color: Colors.gray, marginTop: 2 },
  appRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: 8, borderBottomColor: Colors.borderSoft, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  appTitle: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.textDark },
  appMeta: { fontSize: FontSize.xs, color: Colors.gray, marginTop: 2 },
  emptyText: { color: Colors.gray, fontSize: FontSize.xs },
});
