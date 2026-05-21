// Employer notifications - reuses pattern
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Card, EmptyState } from '../../src/components/ui';
import { api, getApiError } from '../../src/api/client';
import { Colors, Spacing, FontSize } from '../../src/constants/theme';

export default function EmpNotifications() {
  const [notifs, setNotifs] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifs(res.data.notifications || []);
    } catch (err) { console.warn(getApiError(err)); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  const markRead = async (id: number) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch {}
  };

  return (
    <FlatList
      style={styles.container}
      data={notifs}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={{ padding: Spacing.md }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      ListEmptyComponent={<EmptyState message="No notifications yet." />}
      renderItem={({ item }) => (
        <TouchableOpacity testID={`emp-notif-${item.id}`} onPress={() => !item.is_read && markRead(item.id)}>
          <Card style={item.is_read ? { backgroundColor: Colors.surface, opacity: 0.7 } : undefined}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {!item.is_read && <View style={styles.dot} />}
              <Text style={styles.title}>{item.title}</Text>
            </View>
            <Text style={styles.message}>{item.message}</Text>
            <Text style={styles.time}>{new Date(item.created_at).toLocaleString()}</Text>
          </Card>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.lightBg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accent, marginRight: 8 },
  title: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark, flex: 1 },
  message: { fontSize: FontSize.sm, color: Colors.textDark, marginTop: 4, lineHeight: 18 },
  time: { fontSize: FontSize.xs, color: Colors.gray, marginTop: 6 },
});
