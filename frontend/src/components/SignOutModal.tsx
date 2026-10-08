import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '../constants/theme';

interface SignOutModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function SignOutModal({ visible, onCancel, onConfirm }: SignOutModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Sign Out</Text>
          <Text style={styles.message}>Are you sure you want to sign out?</Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              activeOpacity={0.8}
              onPress={onCancel}
              testID="signout-cancel"
            >
              <Text style={[styles.buttonText, styles.cancelText]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.exitButton]}
              activeOpacity={0.8}
              onPress={onConfirm}
              testID="signout-confirm"
            >
              <Text style={styles.buttonText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default SignOutModal;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: Colors.white,
    borderRadius: 24,
    paddingTop: 24,
    paddingBottom: 22,
    paddingHorizontal: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  message: {
    fontSize: FontSize.md,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 26,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  button: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Cancel is the safe choice, so it is outlined; only the sign-out action is filled.
  cancelButton: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  exitButton: {
    backgroundColor: Colors.error,
  },
  cancelText: {
    color: Colors.textDark,
  },
  buttonText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
