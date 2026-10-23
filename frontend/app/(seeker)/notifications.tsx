// ============================================================
// Job Seeker Notifications
// ============================================================
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Card, EmptyState } from '../../src/components/ui';
import { api, getApiError } from '../../src/api/client';
import { alertCountChanged } from '../../src/utils/alertBadge';
import { Colors, Spacing, FontSize, Radius } from '../../src/constants/theme';

export default function SeekerNotifications() {
  const [notifs, setNotifs] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  // Only the latest 50 alerts are listed, so the unread count comes from the server (it counts all of them).
  const [unread, setUnread] = useState(0);
  const [markingAll, setMarkingAll] = useState(false);

  const load = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifs(res.data.notifications || []);
      setUnread(res.data.unread_count || 0);
      alertCountChanged(res.data.unread_count || 0);
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

  const markRead = async (id: number) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnread((count) => Math.max(0, count - 1));
      alertCountChanged();
    } catch {}
  };

  // Also clears unread alerts older than the 50 listed, which could not be tapped.
  const markAllRead = async () => {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      await api.put('/notifications/read-all');
      await load();
    } catch (err) {
      console.warn(getApiError(err));
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.kicker}>PESO-Link MisOr</Text>
        <Text style={styles.headerTitle}>Notifications</Text>
        <Text style={styles.headerSub}>{unread} unread update{unread === 1 ? '' : 's'}</Text>
        {unread > 0 && (
          <TouchableOpacity testID="mark-all-read" onPress={markAllRead} disabled={markingAll} activeOpacity={0.7}>
            <Text style={styles.markAll}>{markingAll ? 'Marking...' : 'Mark all as read'}</Text>
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={notifs}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={<EmptyState message="No notifications yet." />}
        renderItem={({ item }) => (
          <TouchableOpacity testID={`notif-${item.id}`} onPress={() => !item.is_read && markRead(item.id)} activeOpacity={0.82}>
            <Card style={item.is_read ? styles.readNotificationCard : styles.notificationCard}>
              <View style={styles.titleRow}>
                <View style={[styles.statusMark, item.is_read && styles.readMark]} />
                <Text style={styles.title}>{item.title}</Text>
              </View>
              <Text style={styles.message}>{item.message}</Text>
              <Text style={styles.time}>{new Date(item.created_at).toLocaleString()}</Text>
            </Card>
          </TouchableOpacity>
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
  markAll: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '800', marginTop: 8, textDecorationLine: 'underline' },
  listContent: { padding: Spacing.md, paddingBottom: Spacing.xl },
  notificationCard: { borderRadius: Radius.lg },
  readNotificationCard: { borderRadius: Radius.lg, backgroundColor: Colors.surface, opacity: 0.82 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  statusMark: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.accent, marginRight: 10 },
  readMark: { backgroundColor: Colors.grayLight },
  title: { fontSize: FontSize.md, fontWeight: '900', color: Colors.textDark, flex: 1 },
  message: { fontSize: FontSize.sm, color: Colors.textDark, marginTop: 8, lineHeight: 20 },
  time: { fontSize: FontSize.xs, color: Colors.gray, marginTop: 8 },
});
