// ============================================================
// Warning before leaving a screen with unsaved edits (used by the seeker Profile).
// The screen registers a guard while it is open; tab presses, Back and in-screen links ask first.
// Nothing is saved automatically. A forced sign-out does not go through this, so it is never blocked.
// ============================================================
import { Alert } from 'react-native';

type Guard = {
  hasUnsavedChanges: () => boolean;
  // Called when the user chooses to leave without saving.
  discard: () => void;
};

let current: Guard | null = null;

export function setUnsavedChangesGuard(guard: Guard | null) {
  current = guard;
}

export function hasUnsavedChanges() {
  return !!current && current.hasUnsavedChanges();
}

// Runs `leave` right away when nothing is unsaved; otherwise asks first.
export function confirmLeave(leave: () => void) {
  if (!hasUnsavedChanges()) {
    leave();
    return;
  }
  Alert.alert(
    'Unsaved Changes',
    'Your NSRP profile has changes that are not saved yet. If you leave now, they will be lost.',
    [
      { text: 'Keep Editing', style: 'cancel' },
      {
        text: 'Discard Changes and Leave',
        style: 'destructive',
        onPress: () => {
          current?.discard();
          leave();
        },
      },
    ],
  );
}
