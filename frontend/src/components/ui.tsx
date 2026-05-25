// ============================================================
// Common UI Components
// ============================================================
import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle, KeyboardTypeOptions,
} from 'react-native';
import {
  Colors, Spacing, FontSize, Radius, Shadow, StatusColors, StatusLabels,
} from '../constants/theme';

export function Button({
  title, onPress, variant = 'primary', loading, disabled, testID, style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'accent' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  style?: ViewStyle;
}) {
  const isDisabled = disabled || loading;
  const bgColor =
    variant === 'primary' ? Colors.primary :
    variant === 'secondary' ? Colors.white :
    variant === 'danger' ? Colors.error :
    Colors.accent;
  const textColor = variant === 'secondary' ? Colors.primary : Colors.white;
  const borderColor = variant === 'secondary' ? Colors.primary : 'transparent';

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[
        btn.base,
        variant === 'primary' && btn.primary,
        { backgroundColor: bgColor, borderColor, opacity: isDisabled ? 0.6 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[btn.text, { color: textColor }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const btn = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    minHeight: 52,
  },
  primary: {
    ...Shadow.raised,
  },
  text: {
    fontSize: FontSize.md,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
});

export function Input({
  label, value, onChangeText, placeholder, secureTextEntry, keyboardType,
  multiline, numberOfLines, testID, error, autoCapitalize, editable = true,
}: {
  label?: string;
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  numberOfLines?: number;
  testID?: string;
  error?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  editable?: boolean;
}) {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      {label && <Text style={inp.label}>{label}</Text>}
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.grayLight}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={numberOfLines}
        autoCapitalize={autoCapitalize || 'none'}
        editable={editable}
        style={[
          inp.input,
          multiline && { height: (numberOfLines || 3) * 24 + 16, textAlignVertical: 'top' },
          error ? { borderColor: Colors.error } : null,
          !editable && { backgroundColor: Colors.surface, color: Colors.gray },
        ]}
      />
      {error && <Text style={inp.error}>{error}</Text>}
    </View>
  );
}

const inp = StyleSheet.create({
  label: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textDark,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    borderRadius: Radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 13,
    minHeight: 48,
    fontSize: FontSize.md,
    color: Colors.textDark,
  },
  error: {
    color: Colors.error,
    fontSize: FontSize.xs,
    marginTop: 4,
  },
});

export function Card({ children, style, testID }: { children: React.ReactNode; style?: ViewStyle; testID?: string }) {
  return (
    <View testID={testID} style={[card.base, style]}>
      {children}
    </View>
  );
}

const card = StyleSheet.create({
  base: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.card,
  },
});

export function StatusBadge({ status, testID }: { status: keyof typeof StatusColors; testID?: string }) {
  const cfg = StatusColors[status];
  if (!cfg) return null;
  return (
    <View
      testID={testID}
      style={{
        backgroundColor: cfg.bg,
        borderColor: cfg.border,
        borderWidth: 1,
        paddingHorizontal: 11,
        paddingVertical: 5,
        borderRadius: Radius.pill,
        alignSelf: 'flex-start',
        maxWidth: 150,
      }}
    >
      <Text style={{ color: cfg.text, fontSize: FontSize.xs, fontWeight: '800', textAlign: 'center' }}>
        {StatusLabels[status]}
      </Text>
    </View>
  );
}

export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={hdr.container}>
      <Text style={hdr.title}>{title}</Text>
      {subtitle && <Text style={hdr.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const hdr = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.primaryDark,
  },
  title: { color: Colors.white, fontSize: FontSize.xl, fontWeight: '900' },
  subtitle: { color: Colors.cardHighlight, fontSize: FontSize.sm, marginTop: 4, lineHeight: 20 },
});

export function EmptyState({ message, testID }: { message: string; testID?: string }) {
  return (
    <View testID={testID} style={empty.base}>
      <Text style={{ fontSize: FontSize.md, color: Colors.gray, textAlign: 'center' }}>
        {message}
      </Text>
    </View>
  );
}

const empty = StyleSheet.create({
  base: {
    backgroundColor: Colors.white,
    borderColor: Colors.borderSoft,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.md,
    ...Shadow.card,
  },
});

export function Chip({
  label, active, onPress, testID,
}: { label: string; active?: boolean; onPress?: () => void; testID?: string }) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={{
        backgroundColor: active ? Colors.primary : Colors.white,
        borderColor: active ? Colors.primary : Colors.borderSoft,
        borderWidth: 1,
        paddingHorizontal: 13,
        paddingVertical: 7,
        borderRadius: Radius.pill,
        marginRight: 7,
        marginBottom: 7,
      }}
    >
      <Text
        style={{
          color: active ? Colors.white : Colors.textDark,
          fontSize: FontSize.sm,
          fontWeight: '500',
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function Row({ left, right, style }: { left: string; right: string | number; style?: TextStyle }) {
  return (
    <View style={row.base}>
      <Text style={row.left}>{left}</Text>
      <Text style={[row.right, style]}>
        {right}
      </Text>
    </View>
  );
}

const row = StyleSheet.create({
  base: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomColor: Colors.borderSoft,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  left: {
    color: Colors.gray,
    fontSize: FontSize.sm,
    flex: 1,
  },
  right: {
    color: Colors.textDark,
    fontSize: FontSize.sm,
    fontWeight: '700',
    flex: 1.2,
    textAlign: 'right',
  },
});
