// ============================================================
// Read-only NSRP profile view (PESO Admin referral review + seeker monitoring)
// ============================================================
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Row } from './ui';
import { Colors, Spacing, FontSize, Radius } from '../constants/theme';

export function NsrpRequirements({ requirements }: { requirements?: any }) {
  if (!requirements) return null;
  const complete = !!requirements.isComplete;
  return (
    <View style={[styles.reqBox, complete ? styles.reqBoxOk : styles.reqBoxMissing]}>
      <Text style={styles.reqTitle}>
        NSRP Requirements: {requirements.filled_count}/{requirements.required_count} complete
      </Text>
      {complete ? (
        <Text style={styles.reqText}>All required NSRP items are filled in.</Text>
      ) : (
        requirements.missing_fields.map((f: string) => <Text key={f} style={styles.reqText}>- {f}</Text>)
      )}
    </View>
  );
}

export function NsrpProfileView({ profile, skills }: { profile: any; skills: any[] }) {
  const p = profile || {};
  const full = p.nsrp_full_data || {};
  return (
    <>
      <Section title="Personal Information">
        <Field label="Date of Birth" value={formatDate(p.date_of_birth)} />
        <Field label="Place of Birth" value={full.place_of_birth} />
        <Field label="Sex" value={p.gender} />
        <Field label="Civil Status" value={p.civil_status} />
        <Field label="Religion" value={full.religion} />
        <Field label="Height / Weight" value={[full.height, full.weight].filter(Boolean).join(' / ')} />
        <Field label="Disability" value={[full.disability, full.disability_other].filter(Boolean).join(' - ')} />
      </Section>

      <Section title="Contact and Address">
        <Field label="Contact Number" value={p.contact_number} />
        <Field label="Cell Phone" value={full.cell_phone_number} />
        <Field label="Landline" value={full.landline_number} />
        <Field label="Email (NSRP)" value={full.email_address} />
        <Field label="Address" value={p.address} />
        <Field label="House No. / Street" value={full.house_street} />
        <Field label="Village" value={full.village} />
        <Field label="Barangay" value={full.barangay} />
        <Field label="City / Municipality" value={p.city} />
        <Field label="Province" value={p.province} />
      </Section>

      <Section title="Government IDs">
        <Field label="TIN" value={full.tin} />
        <Field label="GSIS / SSS No." value={full.gsis_sss_no} />
        <Field label="PAG-IBIG No." value={full.pagibig_no} />
        <Field label="PhilHealth No." value={full.philhealth_no} />
        <Field label="Passport No." value={[full.passport_number, full.passport_expiry && `exp. ${full.passport_expiry}`].filter(Boolean).join(' ')} />
      </Section>

      <Section title="Employment Status">
        <Field label="Employment Status" value={p.employment_status} />
        <Field label="Employment Type" value={full.employment_type} />
        <Field label="Actively Looking for Work" value={[full.looking_for_work, full.looking_duration].filter(Boolean).join(' - ')} />
        <Field label="Willing to Work Immediately" value={[full.willing_to_work_immediately, full.available_when].filter(Boolean).join(' - ')} />
        <Field label="4Ps Beneficiary" value={[full.four_ps_beneficiary, full.household_id && `HH ID ${full.household_id}`].filter(Boolean).join(' - ')} />
      </Section>

      <Section title="Job Preference">
        <Field label="Preferred Occupation" value={p.preferred_occupation} />
        <Field label="Preferred Occupations" value={full.preferred_occupations} />
        <Field label="Preferred Work Location" value={full.preferred_work_location} />
        <Field label="Local Locations" value={full.preferred_local_locations} />
        <Field label="Overseas Locations" value={full.preferred_overseas_locations} />
        <Field label="Expected Salary" value={full.expected_salary} />
      </Section>

      <Section title="Language / Dialect">
        <Field label="Languages" value={full.language_dialect} />
        <Field label="Proficiency" value={full.language_proficiency} />
      </Section>

      <Section title="Educational Background">
        <Field label="Education Level" value={p.education_level} />
        <Field label="Course" value={p.course} />
        <Field label="Elementary" value={full.elementary_background} />
        <Field label="Secondary" value={full.secondary_background} />
        <Field label="Tertiary" value={full.tertiary_background} />
        <Field label="Graduate Studies" value={full.graduate_studies_background} />
      </Section>

      <Section title="Training, Eligibility, and Experience">
        <Field label="Years of Experience" value={p.years_of_experience != null ? String(p.years_of_experience) : ''} />
        <Field label="Trainings / Seminars" value={full.trainings} />
        <Field label="Eligibility / Licenses" value={full.eligibility_license} />
        <Field label="Work Experience" value={full.work_experience} />
        <Field label="Other Skills Acquired" value={full.other_skills_acquired} />
      </Section>

      <Section title={`Encoded Skills (${skills.length})`}>
        {skills.length ? (
          <View style={styles.skillWrap}>
            {skills.map((s) => (
              <View key={s.id} style={styles.skillPill}>
                <Text style={styles.skillText}>{s.skill_name}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>No skills encoded.</Text>
        )}
      </Section>
    </>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  const text = String(value ?? '').trim();
  return <Row left={label} right={text || '-'} style={text ? undefined : styles.emptyValue} />;
}

// DATE columns arrive as 'YYYY-MM-DD'; show them without timezone conversion.
export function formatDate(value?: string | null) {
  if (!value) return '';
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return String(value);
  return new Date(y, m - 1, d).toLocaleDateString();
}

const styles = StyleSheet.create({
  reqBox: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.sm },
  reqBoxOk: { backgroundColor: Colors.cardHighlight, borderColor: Colors.primarySoft },
  reqBoxMissing: { backgroundColor: '#FEF3C7', borderColor: Colors.warning },
  reqTitle: { fontSize: FontSize.sm, fontWeight: '900', color: Colors.textDark, marginBottom: 4 },
  reqText: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18, fontWeight: '700' },
  section: { marginTop: Spacing.md },
  sectionTitle: {
    fontSize: FontSize.sm, fontWeight: '900', color: Colors.primary,
    textTransform: 'uppercase', marginBottom: 4,
  },
  emptyValue: { color: Colors.grayLight, fontWeight: '400' },
  skillWrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: Spacing.xs },
  skillPill: {
    backgroundColor: Colors.cardHighlight,
    borderColor: Colors.primary,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
    marginBottom: 6,
  },
  skillText: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: '800' },
  emptyText: { color: Colors.gray, fontSize: FontSize.xs },
});
