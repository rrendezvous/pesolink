// ============================================================
// Unread-alerts badge on the Alerts tab (all three roles).
// The badge lives in each tab layout. It recounts when the user moves between screens, and the
// Alerts screen passes it the latest count after it loads or marks alerts as read, so it never shows an old number.
// Alerts are in-app only: the count updates while the app is open, not as phone notifications.
// ============================================================
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Colors } from '../constants/theme';

let listener: ((count?: number) => void) | null = null;

// With a count, the badge shows it as is; without one, the badge asks the server again.
export function alertCountChanged(count?: number) {
  listener?.(count);
}

export function useUnreadAlertCount(pathname: string | null) {
  const [count, setCount] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const mine = (next?: number) => {
      if (typeof next === 'number') setCount(Math.max(0, next));
      else setTick((t) => t + 1);
    };
    listener = mine;
    // Only remove our own listener: another role's layout may already have replaced it.
    return () => { if (listener === mine) listener = null; };
  }, []);

  useEffect(() => {
    // Skip once the user has signed out and left the role's screens.
    if (!pathname || pathname === '/') return undefined;
    let active = true;
    api.get('/notifications')
      .then((res) => { if (active) setCount(Number(res.data?.unread_count) || 0); })
      .catch(() => {});
    return () => { active = false; };
  }, [pathname, tick]);

  return count;
}

// Same red badge as the admin NSRP tab; very large counts are shown as 99+.
export const alertBadge = (count: number) => (count > 99 ? '99+' : count > 0 ? count : undefined);
export const ALERT_BADGE_STYLE = { backgroundColor: Colors.error, fontSize: 10, fontWeight: '800' as const };
