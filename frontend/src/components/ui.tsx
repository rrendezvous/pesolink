// ============================================================
// Common UI Components
// ============================================================
import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle, KeyboardTypeOptions,
} from 'react-native';
import { Colors, Spacing, FontSize, StatusColors, StatusLabels } from '../constants/theme';

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
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    minHeight: 52,
  },
  text: {
    fontSize: FontSize.md,
    fontWeight: '800',
    textTransform: 'uppercase',
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
    borderColor: Colors.border,
    borderRadius: 7,
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
    borderColor: Colors.border,
    borderRadius: 14,
    padding: Spacing.md,
    marginBottom: Spacing.md,
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
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color: cfg.text, fontSize: FontSize.xs, fontWeight: '700' }}>
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
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.primary,
  },
  title: { color: Colors.white, fontSize: FontSize.xl, fontWeight: '700' },
  subtitle: { color: Colors.cardHighlight, fontSize: FontSize.sm, marginTop: 2 },
});

export function EmptyState({ message, testID }: { message: string; testID?: string }) {
  return (
    <View testID={testID} style={{ padding: Spacing.xl, alignItems: 'center' }}>
      <Text style={{ fontSize: FontSize.md, color: Colors.gray, textAlign: 'center' }}>
        {message}
      </Text>
    </View>
  );
}

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
        borderColor: active ? Colors.primary : Colors.border,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        marginRight: 6,
        marginBottom: 6,
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
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <Text style={{ color: Colors.gray, fontSize: FontSize.sm, flex: 1 }}>{left}</Text>
      <Text style={[{ color: Colors.textDark, fontSize: FontSize.sm, fontWeight: '600', flex: 1, textAlign: 'right' }, style]}>
        {right}
      </Text>
    </View>
  );
}
