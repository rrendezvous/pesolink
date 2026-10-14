// ============================================================
// Job post state shown to employers and PESO Admin.
// Same rule the server uses for job seekers: an active post whose closing date has passed
// no longer accepts applications, so it is shown as Expired.
// ============================================================
export type JobState = 'active' | 'expired' | 'closed';

export const JOB_STATE_LABELS: Record<JobState, string> = { active: 'Active', expired: 'Expired', closed: 'Closed' };

// Today as YYYY-MM-DD in local time (the server sends closing dates in the same form).
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function jobState(job: { status?: string; closing_date?: string | null }): JobState {
  if (job.status !== 'active') return 'closed';
  const closing = job.closing_date ? String(job.closing_date).slice(0, 10) : '';
  return closing && closing < todayKey() ? 'expired' : 'active';
}
