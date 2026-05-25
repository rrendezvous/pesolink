// ============================================================
// PESO-Link MisOr - Color Palette (Strict)
// ============================================================
export const Colors = {
  primary: '#047857',        // Primary Green
  primaryDark: '#065F46',    // Deep Emerald
  primarySoft: '#0B8F68',
  accent: '#22C55E',         // Accent / Success
  lightBg: '#EEF5F2',        // App Background
  cardHighlight: '#ECFDF5',  // Card Highlight
  textDark: '#1F2937',       // Main Text
  textSecondary: '#4B635B',  // Secondary Text
  border: '#D1D5DB',         // Border / Divider
  borderSoft: '#E2E8E4',
  surface: '#F8FAFC',        // Neutral Surface
  surfaceMuted: '#F1F5F3',
  white: '#FFFFFF',
  error: '#DC2626',
  warning: '#F59E0B',
  gray: '#6B7280',
  grayLight: '#9CA3AF',
  muted: '#EEF2F1',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
};

export const Shadow = {
  card: {
    shadowColor: '#0F2F26',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  raised: {
    shadowColor: '#022C22',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 4,
  },
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 30,
};

export const StatusColors = {
  submitted: { bg: Colors.cardHighlight, text: Colors.primaryDark, border: Colors.primarySoft },
  pending: { bg: Colors.surfaceMuted, text: Colors.textDark, border: Colors.grayLight },
  for_review: { bg: Colors.cardHighlight, text: Colors.primary, border: Colors.primary },
  for_interview: { bg: '#DBEAFE', text: '#1E40AF', border: '#1E40AF' },
  hired: { bg: '#DCFCE7', text: '#166534', border: '#16A34A' },
  rejected: { bg: '#FEE2E2', text: '#991B1B', border: '#DC2626' },
  closed: { bg: '#E5E7EB', text: '#374151', border: '#9CA3AF' },
};

export const StatusLabels = {
  submitted: 'Submitted',
  pending: 'Pending',
  for_review: 'For Review',
  for_interview: 'For Interview',
  hired: 'Hired',
  rejected: 'Rejected',
  closed: 'Closed',
};
