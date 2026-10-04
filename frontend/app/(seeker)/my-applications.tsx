// ============================================================
// My Applications - Job Seeker's PESO-referred applications (list + detail with status history)
// ============================================================
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Modal, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { StatusBadge, EmptyState, Row, Button } from '../../src/components/ui';
import { api, getApiError } from '../../src/api/client';
import {
  REFERRAL_STATUS_LABELS, canRequestAgain, currentStatus, describeHistory,
} from '../../src/utils/referral';
import { Colors, Spacing, FontSize, Radius, Shadow, StatusLabels } from '../../src/constants/theme';

export default function MyApplications() {
  const router = useRouter();
  const [apps, setApps] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<{ application: any; history: any[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

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

  const openDetail = async (item: any) => {
    setDetail({ application: item, history: [] });
    setDetailLoading(true);
    try {
      const res = await api.get(`/applications/${item.id}`);
      setDetail({ application: res.data.application, history: res.data.history || [] });
    } catch (err) {
      Alert.alert('Error', getApiError(err));
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const viewJob = () => {
    const jobId = detail?.application?.job_post_id;
    setDetail(null);
    if (jobId) router.push(`/(seeker)/job/${jobId}`);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.kicker}>PESO-Link MisOr</Text>
        <Text style={styles.headerTitle}>Application Status</Text>
        <Text style={styles.headerSub}>Track your PESO-referred applications. Tap one to see its full history.</Text>
      </View>

      <FlatList
        data={apps}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={<EmptyState message="No applications yet. Once PESO verifies your NSRP profile, browse jobs and tap Apply with PESO Referral." />}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => openDetail(item)} testID={`my-app-${item.id}`} activeOpacity={0.85} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.companyMark}>
                <Text style={styles.companyMarkText}>{(item.company_name || 'P').charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.title}>{item.job_title}</Text>
                <Text style={styles.company}>{item.company_name}</Text>
                <Text style={styles.meta}>{item.location} / {item.job_type}</Text>
              </View>
              <StatusBadge status={currentStatus(item).status} testID={`status-${item.id}`} />
            </View>
            <View style={styles.statusPanel}>
              <View style={{ flex: 1 }}>
                <Text style={styles.statusLabel}>
                  {currentStatus(item).stage === 'Employer' ? 'With employer' : 'Referral record'}
                </Text>
                <Text style={styles.date}>
                  Applied {new Date(item.applied_at).toLocaleDateString()}
                  {item.updated_at ? ` / Updated ${new Date(item.updated_at).toLocaleDateString()}` : ''}
                </Text>
              </View>
              {item.referral_status === 'peso_referred' && <PesoReferredPill />}
            </View>
          </TouchableOpacity>
        )}
      />

      <Modal visible={!!detail} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            {detail && (
              <ScrollView>
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>{detail.application.job_title}</Text>
                    <Text style={styles.modalSubtle}>{detail.application.company_name}</Text>
                  </View>
                  <StatusBadge status={currentStatus(detail.application).status} />
                </View>

                {detail.application.referral_status === 'peso_referred' && (
                  <View style={styles.pesoBox}>
                    <Text style={styles.pesoTitle}>PESO-Referred</Text>
                    <Text style={styles.pesoText}>
                      Sent to the employer with your PESO-verified NSRP profile. This is not a hiring decision.
                    </Text>
                  </View>
                )}

                {!!detail.application.referral_notes && (
                  <Text style={styles.pesoNote}>PESO note: {detail.application.referral_notes}</Text>
                )}

                <Text style={styles.sectionTitle}>Application Details</Text>
                <Row
                  left="Referral Status"
                  right={REFERRAL_STATUS_LABELS[detail.application.referral_status] || detail.application.referral_status}
                />
                {detail.application.referral_status === 'peso_referred' && (
                  <Row
                    left="Employer Status"
                    right={StatusLabels[detail.application.application_status as keyof typeof StatusLabels] || detail.application.application_status}
                  />
                )}
                <Row left="Location" right={detail.application.location || 'N/A'} />
                <Row left="Job Type" right={detail.application.job_type || 'N/A'} style={{ textTransform: 'capitalize' }} />
                {(detail.application.salary_min || detail.application.salary_max) && (
                  <Row
                    left="Salary"
                    right={[detail.application.salary_min, detail.application.salary_max]
                      .filter(Boolean).map((v: any) => `PHP ${Number(v).toLocaleString()}`).join(' - ')}
                  />
                )}
                {!!detail.application.contact_person && <Row left="Employer Contact" right={detail.application.contact_person} />}
                <Row left="Applied" right={new Date(detail.application.applied_at).toLocaleString()} />
                {detail.application.job_status === 'closed' && <Row left="Job Post" right="Closed" />}

                {!!detail.application.cover_letter && (
                  <>
                    <Text style={styles.sectionTitle}>Cover Letter</Text>
                    <Text style={styles.coverLetter}>{detail.application.cover_letter}</Text>
                  </>
                )}

                <Text style={styles.sectionTitle}>Status History</Text>
                {detailLoading ? (
                  <ActivityIndicator color={Colors.primary} style={{ marginVertical: Spacing.md }} />
                ) : detail.history.length === 0 ? (
                  <Text style={styles.emptyText}>No status changes recorded yet.</Text>
                ) : (
                  <View style={styles.timeline}>
                    {detail.history.map((h, idx) => {
                      const isLast = idx === detail.history.length - 1;
                      return (
                        <View key={h.id} style={styles.timelineItem} testID={`history-${h.id}`}>
                          <View style={styles.timelineRail}>
                            <View style={[styles.timelineDot, isLast && styles.timelineDotCurrent]} />
                            {!isLast && <View style={styles.timelineLine} />}
                          </View>
                          <View style={styles.timelineBody}>
                            <Text style={styles.timelineStatus}>{describeHistory(h)}</Text>
                            <Text style={styles.timelineDate}>{new Date(h.changed_at).toLocaleString()}</Text>
                            {!!h.notes && <Text style={styles.timelineNotes}>{h.notes}</Text>}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                <View style={{ marginTop: Spacing.md }}>
                  <Button
                    testID="view-job"
                    title={canRequestAgain(detail.application.referral_status) && detail.application.job_status !== 'closed'
                      ? 'View Job and Apply Again'
                      : 'View Job Post'}
                    onPress={viewJob}
                  />
                </View>
                <View style={{ marginTop: Spacing.sm }}>
                  <Button testID="close-app-detail" title="Close" variant="secondary" onPress={() => setDetail(null)} />
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function PesoReferredPill() {
  return (
    <View style={styles.pesoPill}>
      <Text style={styles.pesoPillText}>PESO-Referred</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardHighlight,
    borderColor: Colors.borderSoft,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginTop: Spacing.md,
  },
  statusLabel: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: '900' },
  date: { fontSize: FontSize.xs, color: Colors.gray, marginTop: 4 },
  pesoPill: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pesoPillText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: '900' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    maxHeight: '88%',
    ...Shadow.raised,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '900', color: Colors.textDark },
  modalSubtle: { fontSize: FontSize.sm, color: Colors.gray, marginTop: 2 },
  pesoBox: {
    backgroundColor: Colors.cardHighlight,
    borderColor: Colors.primary,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginTop: Spacing.md,
  },
  pesoNote: { color: '#92400E', fontSize: FontSize.sm, fontWeight: '700', lineHeight: 20, marginTop: Spacing.md },
  pesoTitle: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '900' },
  pesoText: { color: Colors.textSecondary, fontSize: FontSize.xs, lineHeight: 18, marginTop: 2 },
  sectionTitle: {
    fontSize: FontSize.sm, fontWeight: '900', color: Colors.primary,
    textTransform: 'uppercase', marginTop: Spacing.md, marginBottom: 4,
  },
  coverLetter: {
    fontSize: FontSize.sm,
    color: Colors.textDark,
    lineHeight: 20,
    backgroundColor: Colors.surface,
    padding: 10,
    borderRadius: Radius.sm,
  },
  emptyText: { color: Colors.gray, fontSize: FontSize.xs },
  timeline: { marginTop: Spacing.xs },
  timelineItem: { flexDirection: 'row' },
  timelineRail: { width: 22, alignItems: 'center' },
  timelineDot: {
    width: 12, height: 12, borderRadius: 6, marginTop: 3,
    backgroundColor: Colors.white, borderColor: Colors.primary, borderWidth: 2,
  },
  timelineDotCurrent: { backgroundColor: Colors.primary },
  timelineLine: { flex: 1, width: 2, backgroundColor: Colors.borderSoft, marginVertical: 2 },
  timelineBody: { flex: 1, paddingBottom: Spacing.md, paddingLeft: Spacing.xs },
  timelineStatus: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.textDark },
  timelineDate: { fontSize: FontSize.xs, color: Colors.gray, marginTop: 2 },
  timelineNotes: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 4, lineHeight: 18 },
});
