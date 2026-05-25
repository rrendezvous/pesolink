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
import { Colors, Spacing, FontSize, Radius } from '../../src/constants/theme';

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

  const updateReferralStatus = (seeker: any, referralStatus: 'referral_ready' | 'needs_revision') => {
    const isReady = referralStatus === 'referral_ready';
    confirmAction(
      isReady ? 'Mark as Referral-Ready' : 'Request Revision',
      isReady
        ? `Mark "${seeker.first_name} ${seeker.last_name}" as PESO Referral-Ready?`
        : `Request NSRP revisions from "${seeker.first_name} ${seeker.last_name}"?`,
      async () => {
        setBusyId(seeker.id);
        try {
          await api.put(`/admin/job-seekers/${seeker.id}/referral-status`, {
            referral_status: referralStatus,
            notes: isReady ? null : 'Please review and correct incomplete, invalid, or inappropriate NSRP information.',
          });
          await load();
        } catch (err) {
          Alert.alert('Error', getApiError(err));
        } finally {
          setBusyId(null);
        }
      },
      isReady ? 'Mark Ready' : 'Request Revision',
      !isReady,
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.kicker}>PESO-Link MisOr</Text>
        <Text style={styles.headerTitle}>Job Seekers</Text>
        <Text style={styles.headerSub}>Review NSRP profiles and referral-ready status</Text>
      </View>
      <FlatList
        data={seekers}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={<EmptyState message="No job seekers registered yet." />}
        renderItem={({ item }) => {
          const isActive = item.account_status === 'active';
          return (
            <Card testID={`seeker-${item.id}`} style={styles.seekerCard}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.first_name} {item.last_name}</Text>
                  <Text style={styles.subtitle}>{item.email}</Text>
                </View>
                <View style={[styles.referralPill, getReferralPillStyle(item.referral_status)]}>
                  <Text style={[styles.referralPillText, item.referral_status === 'referral_ready' && { color: Colors.white }]}>
                    {getReferralShort(item.referral_status)}
                  </Text>
                </View>
              </View>
              <View style={{ marginTop: Spacing.sm }}>
                <Row left="Location" right={`${item.city || ''} ${item.province || ''}`.trim() || 'N/A'} />
                <Row left="Profile Complete" right={item.profile_completed ? 'Yes' : 'No'} />
                <Row left="Referral Status" right={getReferralLabel(item.referral_status)} />
                <Row left="Account" right={String(item.account_status).toUpperCase()} />
                <Row left="Registered" right={new Date(item.registered_at).toLocaleDateString()} />
              </View>
              {item.profile_completed && item.referral_status !== 'referral_ready' && (
                <View style={{ marginTop: Spacing.sm }}>
                  <Button
                    testID={`referral-ready-${item.id}`}
                    title="Mark as Referral-Ready"
                    onPress={() => updateReferralStatus(item, 'referral_ready')}
                    loading={busyId === item.id}
                  />
                </View>
              )}
              {item.profile_completed && item.referral_status !== 'needs_revision' && (
                <View style={{ marginTop: Spacing.sm }}>
                  <Button
                    testID={`revision-${item.id}`}
                    title="Request Revision"
                    variant="secondary"
                    onPress={() => updateReferralStatus(item, 'needs_revision')}
                    loading={busyId === item.id}
                  />
                </View>
              )}
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
    </View>
  );
}

function getReferralLabel(status: string) {
  if (status === 'submitted') return 'Submitted for Review';
  if (status === 'needs_revision') return 'Needs Revision';
  if (status === 'referral_ready') return 'PESO Referral-Ready';
  return 'Draft';
}

function getReferralShort(status: string) {
  if (status === 'submitted') return 'Review';
  if (status === 'needs_revision') return 'Revise';
  if (status === 'referral_ready') return 'Ready';
  return 'Draft';
}

function getReferralPillStyle(status: string) {
  if (status === 'referral_ready') return { backgroundColor: Colors.primary, borderColor: Colors.primary };
  if (status === 'submitted') return { backgroundColor: '#FEF3C7', borderColor: Colors.warning };
  if (status === 'needs_revision') return { backgroundColor: '#FEE2E2', borderColor: Colors.error };
  return { backgroundColor: Colors.muted, borderColor: Colors.border };
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
  seekerCard: { borderRadius: Radius.lg },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  name: { fontSize: FontSize.lg, fontWeight: '900', color: Colors.textDark },
  subtitle: { fontSize: FontSize.sm, color: Colors.primary, marginTop: 2 },
  referralPill: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  referralPillText: { color: Colors.textDark, fontSize: FontSize.xs, fontWeight: '900' },
});
