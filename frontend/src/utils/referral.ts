// ============================================================
// PESO referral workflow - shared labels and display rules
// NSRP status (PESO Admin, once): not_submitted -> submitted -> for_review -> verified | needs_revision
// A PESO-verified job seeker applies to any job with one tap; the record reaches the employer as PESO-Referred.
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

export const NSRP_STATUS_LABELS: Record<string, string> = {
  not_submitted: 'Not Submitted',
  submitted: 'Submitted',
  for_review: 'For Review',
  verified: 'PESO-Verified',
  needs_revision: 'Needs Revision',
};

// NSRP profiles waiting on PESO Admin.
export const NSRP_OPEN_STATUSES = ['submitted', 'for_review'];

// What the job seeker should know or do next about their NSRP verification.
export function nsrpStatusMessage(status?: string) {
  switch (status) {
    case 'verified':
      return 'PESO verified your NSRP profile. You can apply to jobs with PESO referral. Changing your NSRP profile sends it back to PESO for re-checking.';
    case 'submitted':
      return 'Your NSRP profile was sent to PESO Misamis Oriental and is waiting to be checked.';
    case 'for_review':
      return 'PESO Misamis Oriental is checking your NSRP profile.';
    case 'needs_revision':
      return 'PESO returned your NSRP profile. Fix the items in the PESO note, then submit it again.';
    default:
      return 'Complete the required NSRP items, then submit your profile to PESO for a one-time verification.';
  }
}

// Older per-job referral records PESO had not decided yet.
export const OPEN_REFERRAL_STATUSES = ['submitted', 'for_review'];

// For PESO-referred records the employer's status is the one that moves, so show that;
// otherwise show the referral record's own status (older per-job records).
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
  if (h.status_type === 'referral' && h.new_status === 'peso_referred') return 'Sent to employer as PESO-Referred';
  return `${actor}: ${label}`;
}
