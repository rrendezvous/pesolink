// ============================================================
// PESO referral workflow - shared labels and display rules
// Referral status (PESO Admin):  submitted -> for_review -> peso_referred | rejected, or closed
// Application status (employer, after PESO-Referred): for_review -> for_interview -> hired | rejected
// ============================================================
import { StatusLabels } from '../constants/theme';

export type StatusKey = keyof typeof StatusLabels;

export const REFERRAL_STATUS_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  for_review: 'For Review',
  peso_referred: 'PESO-Referred',
  rejected: 'Rejected',
  closed: 'Closed',
};

// Requests PESO Admin has not decided yet.
export const OPEN_REFERRAL_STATUSES = ['submitted', 'for_review'];

// Once PESO endorses a request the employer's status is the one that moves, so show that;
// before that, show where the referral request stands with PESO.
export function currentStatus(app: {
  referral_status?: string; application_status?: string;
}): { status: StatusKey; stage: 'PESO' | 'Employer' } {
  const referral = app.referral_status || 'submitted';
  if (referral === 'peso_referred') {
    const employerStatus = app.application_status || 'for_review';
    return { status: employerStatus as StatusKey, stage: 'Employer' };
  }
  return { status: referral as StatusKey, stage: 'PESO' };
}

export function canRequestAgain(referralStatus?: string) {
  return referralStatus === 'rejected' || referralStatus === 'closed';
}

// One line per history row, naming who acted: "PESO: For Review", "Employer: For Interview".
export function describeHistory(h: { status_type?: string; new_status: string }) {
  const actor = h.status_type === 'referral' ? 'PESO' : 'Employer';
  const label = h.status_type === 'referral'
    ? REFERRAL_STATUS_LABELS[h.new_status] || h.new_status
    : StatusLabels[h.new_status as StatusKey] || h.new_status;
  if (h.status_type === 'referral' && h.new_status === 'submitted') return 'Referral requested';
  return `${actor}: ${label}`;
}
