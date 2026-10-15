// ============================================================
// Refresh signal for the admin NSRP tab badge.
// The badge lives in the tab layout; the NSRP screen tells it to recount after its list reloads
// (for example after Verify or Return), so the badge never shows an old number.
// ============================================================

let listener: (() => void) | null = null;

export function onNsrpCountChanged(handler: (() => void) | null) {
  listener = handler;
}

export function nsrpCountChanged() {
  listener?.();
}
