// ============================================================
// Application progress steps (display only, built from the existing statuses and history)
// PESO-Referred -> For Review -> For Interview -> Hired | Rejected | Closed
// ============================================================
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, StatusColors } from '../constants/theme';

type StepState = 'done' | 'current' | 'skipped' | 'upcoming';

const EMPLOYER_STEPS = ['for_review', 'for_interview'];
const FINAL_LABELS: Record<string, string> = { hired: 'Hired', rejected: 'Rejected', closed: 'Closed' };

export function ApplicationSteps({
  applicationStatus, history, testID,
}: { applicationStatus?: string; history?: { status_type?: string; new_status: string }[]; testID?: string }) {
  const status = applicationStatus || 'for_review';
  const isFinal = status in FINAL_LABELS;
  // Statuses the employer actually set, when the history is available.
  const reached = history
    ? new Set(history.filter((h) => h.status_type !== 'referral').map((h) => h.new_status))
    : null;

  const steps: { label: string; state: StepState; tone?: 'green' | 'red' | 'grey' }[] = [
    { label: 'PESO-Referred', state: 'done' },
  ];
  EMPLOYER_STEPS.forEach((key, i) => {
    const label = key === 'for_review' ? 'For Review' : 'For Interview';
    let state: StepState;
    if (status === key) state = 'current';
    else if (isFinal || EMPLOYER_STEPS.indexOf(status) > i) {
      // For Review is where every referred application starts, so it always counts as reached.
      state = key === 'for_review' || !reached || reached.has(key) ? 'done' : 'skipped';
    } else state = 'upcoming';
    steps.push({ label, state });
  });
  if (isFinal) {
    const tone = status === 'hired' ? 'green' : status === 'rejected' ? 'red' : 'grey';
    steps.push({ label: FINAL_LABELS[status], state: 'current', tone });
  } else {
    steps.push({ label: 'Hired', state: 'upcoming' });
  }

  return (
    <View style={styles.row} testID={testID} accessibilityLabel={`Application progress: ${steps.find((s) => s.state === 'current')?.label || ''}`}>
      {steps.map((step, i) => {
        const color = dotColor(step);
        return (
          <View key={step.label} style={styles.step}>
            <View style={styles.track}>
              <View style={[styles.line, i === 0 && styles.lineHidden, lineDone(steps, i) && styles.lineDone]} />
              <View style={[styles.dot, { borderColor: color }, (step.state === 'done' || step.state === 'current') && { backgroundColor: color }]}>
                {step.state === 'done' && <Ionicons name="checkmark" size={12} color={Colors.white} />}
                {step.state === 'current' && step.tone === 'red' && <Ionicons name="close" size={12} color={Colors.white} />}
                {step.state === 'current' && step.tone !== 'red' && <View style={styles.dotCore} />}
              </View>
              <View style={[styles.line, i === steps.length - 1 && styles.lineHidden, lineDone(steps, i + 1) && styles.lineDone]} />
            </View>
            <Text
              style={[styles.label, step.state === 'current' && { color, fontWeight: '900' }, step.state === 'skipped' && styles.labelSkipped]}
              numberOfLines={2}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function dotColor(step: { state: StepState; tone?: string }) {
  if (step.state === 'upcoming' || step.state === 'skipped') return Colors.border;
  if (step.tone === 'red') return StatusColors.rejected.border;
  if (step.tone === 'grey') return StatusColors.closed.border;
  return Colors.primary;
}

// The connector leading into step i is solid once step i has been reached.
function lineDone(steps: { state: StepState }[], i: number) {
  const step = steps[i];
  return !!step && step.state !== 'upcoming';
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginTop: 4 },
  step: { flex: 1, alignItems: 'center' },
  track: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  line: { flex: 1, height: 2, backgroundColor: Colors.borderSoft },
  lineDone: { backgroundColor: Colors.primary },
  lineHidden: { backgroundColor: 'transparent' },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCore: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.white },
  label: { marginTop: 6, fontSize: FontSize.xs, color: Colors.gray, fontWeight: '700', textAlign: 'center' },
  labelSkipped: { textDecorationLine: 'line-through' },
});
