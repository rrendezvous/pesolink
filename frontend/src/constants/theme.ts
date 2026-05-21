// ============================================================
// PESO-Link MisOr - Color Palette (Strict)
// ============================================================
export const Colors = {
  primary: '#047857',        // Primary Green
  primaryDark: '#065F46',    // Deep Emerald
  accent: '#22C55E',         // Accent / Success
  lightBg: '#ECFDF5',        // Light Background
  cardHighlight: '#D1FAE5',  // Card Highlight
  textDark: '#064E3B',       // Text Dark
  textSecondary: '#047857',  // Secondary Text
  border: '#A7F3D0',         // Border / Divider
  surface: '#F8FAFC',        // Neutral Surface
  white: '#FFFFFF',
  error: '#DC2626',
  warning: '#F59E0B',
  gray: '#6B7280',
  grayLight: '#9CA3AF',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
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
  submitted: { bg: Colors.lightBg, text: Colors.primary, border: Colors.primary },
  pending: { bg: Colors.surface, text: Colors.textDark, border: Colors.textDark },
  for_review: { bg: Colors.cardHighlight, text: Colors.primary, border: Colors.primary },
  referred: { bg: '#DBEAFE', text: '#1E40AF', border: '#1E40AF' },
  rejected: { bg: '#FEE2E2', text: '#991B1B', border: '#DC2626' },
  closed: { bg: '#E5E7EB', text: '#374151', border: '#9CA3AF' },
};

export const StatusLabels = {
  submitted: 'Submitted',
  pending: 'Pending',
  for_review: 'For Review',
  referred: 'Referred',
  rejected: 'Rejected',
  closed: 'Closed',
};
