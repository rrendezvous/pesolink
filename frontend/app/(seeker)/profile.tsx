// ============================================================
// NSRP Profile + Skills Management (combined screen)
// ============================================================
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Input, Card, Chip, StatusBadge } from '../../src/components/ui';
import { NsrpForm } from '../../src/components/NsrpForm';
import { api, getApiError } from '../../src/api/client';
import { nsrpStatusMessage } from '../../src/utils/referral';
import { Colors, Spacing, FontSize, Radius } from '../../src/constants/theme';


const defaultNsrpFullData = {
  suffix: '',
  place_of_birth: '',
  religion: '',
  height: '',
  weight: '',
  tin: '',
  gsis_sss_no: '',
  pagibig_no: '',
  philhealth_no: '',
  email_address: '',
  landline_number: '',
  cell_phone_number: '',
  house_street: '',
  village: '',
  barangay: '',
  disability: '',
  disability_other: '',
  employment_type: '',
  looking_for_work: '',
  looking_duration: '',
  willing_to_work_immediately: '',
  available_when: '',
  four_ps_beneficiary: '',
  household_id: '',
  language_dialect: '',
  language_proficiency: '',
  other_skills: '',
  other_skills_acquired: '',
  trainings: '',
  eligibility_license: '',
  work_experience: '',
  elementary_background: '',
  secondary_background: '',
  tertiary_background: '',
  graduate_studies_background: '',
  preferred_occupations: '',
  preferred_work_location: '',
  preferred_local_locations: '',
  preferred_overseas_locations: '',
  expected_salary: '',
  availability: '',
  passport_number: '',
  passport_expiry: '',
};

const hasText = (value: any) => String(value ?? '').trim().length > 0;
const hasAny = (...values: any[]) => values.some(hasText);
const anyRowFilled = (rows: any[]) => rows.some((r) => r && Object.values(r).some(hasText));

function getMissingReferralFields(form: any, full: Record<string, any>, selectedSkills: Set<number>) {
  const checks = [
    { label: 'First name', ok: hasText(form.first_name) },
    { label: 'Last name', ok: hasText(form.last_name) },
    { label: 'Date of birth', ok: hasText(form.date_of_birth) },
    { label: 'Place of birth', ok: hasText(full.place_of_birth) },
    { label: 'Sex', ok: hasText(form.gender) },
    { label: 'Civil status', ok: hasText(form.civil_status) },
    { label: 'Contact number or cellphone number', ok: hasAny(form.contact_number, full.cell_phone_number, full.landline_number) },
    { label: 'Present address or house/street/barangay', ok: hasAny(form.address, full.house_street) && hasAny(form.address, full.barangay) },
    { label: 'City/Municipality', ok: hasText(form.city) },
    { label: 'Province', ok: hasText(form.province) },
    { label: 'Employment status', ok: hasText(form.employment_status) },
    { label: 'Employment type', ok: hasText(full.employment_type) },
    { label: 'Actively looking for work', ok: hasText(full.looking_for_work) },
    { label: 'Willing to work immediately', ok: hasText(full.willing_to_work_immediately) },
    { label: '4Ps beneficiary answer', ok: hasText(full.four_ps_beneficiary) },
    { label: 'Educational background', ok: hasAny(form.education_level, form.course, full.elementary_background, full.secondary_background, full.tertiary_background, full.graduate_studies_background) || anyRowFilled(Object.values(full.education || {})) },
    { label: 'Preferred occupation', ok: hasAny(form.preferred_occupation, full.preferred_occupations, ...(full.preferred_occupation_list || [])) },
    { label: 'Preferred work location', ok: hasAny(full.preferred_work_location, full.preferred_local_locations, full.preferred_overseas_locations, ...(full.local_location_list || []), ...(full.overseas_location_list || [])) },
    { label: 'At least one skill, training, or work experience', ok: selectedSkills.size > 0 || hasAny(full.other_skills_acquired, full.trainings, full.eligibility_license, full.work_experience) || anyRowFilled([...(full.training_rows || []), ...(full.work_rows || []), ...(full.eligibility_rows || []), ...(full.license_rows || [])]) },
  ];
  return checks.filter((check) => !check.ok).map((check) => check.label);
}

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({
    first_name: '', middle_name: '', last_name: '',
    date_of_birth: '', gender: '', civil_status: '',
    contact_number: '', address: '', city: '', province: 'Misamis Oriental',
    education_level: '', course: '',
    years_of_experience: '0',
    employment_status: '', preferred_occupation: '',
  });
  const [nsrpFullData, setNsrpFullData] = useState(defaultNsrpFullData);
  const [allSkills, setAllSkills] = useState<any[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<Set<number>>(new Set());
  const [nsrp, setNsrp] = useState<{ status: string; notes?: string | null }>({ status: 'not_submitted' });
  const [submitting, setSubmitting] = useState(false);
  const [certified, setCertified] = useState(false);

  const goToDashboard = () => {
    router.replace('/(seeker)/dashboard');
  };

  useEffect(() => {
    (async () => {
      try {
        const [p, s] = await Promise.all([
          api.get('/job-seeker/profile'),
          api.get('/skills'),
        ]);
        const prof = p.data.profile;
        const parsedFullData = parseFullData(prof.nsrp_full_data);
        setForm({
          first_name: prof.first_name || '',
          middle_name: prof.middle_name || '',
          last_name: prof.last_name || '',
          date_of_birth: prof.date_of_birth ? new Date(prof.date_of_birth).toISOString().split('T')[0] : '',
          gender: prof.gender || '',
          civil_status: prof.civil_status || '',
          contact_number: prof.contact_number || '',
          address: prof.address || '',
          city: prof.city || '',
          province: prof.province || 'Misamis Oriental',
          education_level: prof.education_level || '',
          course: prof.course || '',
          years_of_experience: String(prof.years_of_experience ?? 0),
          employment_status: prof.employment_status || '',
          preferred_occupation: prof.preferred_occupation || '',
        });
        setNsrpFullData(normalizeYesNo({ ...defaultNsrpFullData, ...parsedFullData }));
        setAllSkills(s.data.skills);
        setSelectedSkills(new Set((p.data.skills || []).map((sk: any) => sk.id)));
        setNsrp({ status: prof.nsrp_status || 'not_submitted', notes: prof.nsrp_review_notes });
      } catch (err) {
        Alert.alert('Error', getApiError(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setField = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const toggleSkill = (id: number) => {
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Saves the profile and skills. Returns the new NSRP status if saving changed it
  // (a changed PESO-verified profile goes back to PESO for re-checking).
  const saveProfileDraft = async (): Promise<string | null> => {
    const res = await api.post('/job-seeker/profile', {
        ...form,
        years_of_experience: parseInt(form.years_of_experience, 10) || 0,
        nsrp_full_data: nsrpFullData,
      });
    const skillsRes = await api.post('/job-seeker/skills', {
      skills: Array.from(selectedSkills).map((id) => ({ skill_id: id, proficiency_level: 'intermediate' })),
    });
    const changedTo = res.data.nsrp_status_changed_to || skillsRes.data.nsrp_status_changed_to || null;
    if (changedTo) setNsrp({ status: changedTo, notes: null });
    return changedTo;
  };

  const sentBackMessage = (changedTo: string | null) => {
    if (changedTo === 'submitted') {
      return 'Your NSRP profile changed, so it was sent back to PESO for re-checking. You can apply with PESO referral again once PESO verifies it.';
    }
    if (changedTo === 'not_submitted') {
      return 'Some required NSRP items are now missing. Complete them and submit your profile to PESO again.';
    }
    return null;
  };

  const handleSubmitToPeso = async () => {
    if (!form.first_name || !form.last_name) {
      Alert.alert('Required', 'First and last name are required.');
      return;
    }
    setSubmitting(true);
    try {
      await saveProfileDraft();
      await api.post('/job-seeker/profile/submit-nsrp', { certified });
      setNsrp({ status: 'submitted', notes: null });
      Alert.alert(
        'Sent to PESO',
        'Your NSRP profile was sent to PESO Misamis Oriental for verification. You will be notified when PESO verifies it, then you can apply to jobs with one tap.',
      );
    } catch (err: any) {
      const missing = err?.response?.data?.missing_fields;
      Alert.alert(
        'Not Submitted',
        Array.isArray(missing) && missing.length ? `Complete these first:\n\n${missing.slice(0, 8).join('\n')}` : getApiError(err),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSave = async () => {
    if (!form.first_name || !form.last_name) {
      Alert.alert('Required', 'First and last name are required.');
      return;
    }
    setSaving(true);
    try {
      const changedTo = await saveProfileDraft();
      Alert.alert('Saved', sentBackMessage(changedTo) || 'Profile updated successfully.', [
        { text: 'OK', onPress: goToDashboard },
      ]);
    } catch (err) {
      Alert.alert('Error', getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const skillsByCategory: Record<string, any[]> = {};
  for (const sk of allSkills) {
    const cat = sk.category || 'Other';
    if (!skillsByCategory[cat]) skillsByCategory[cat] = [];
    skillsByCategory[cat].push(sk);
  }
  const missingReferralFields = getMissingReferralFields(form, nsrpFullData, selectedSkills);
  const requiredReferralCount = 19;
  const filledReferralCount = requiredReferralCount - missingReferralFields.length;

  if (loading) {
    return <View style={styles.center}><Text style={styles.loadingText}>Loading...</Text></View>;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity testID="profile-back" onPress={goToDashboard} activeOpacity={0.75} style={styles.backButton}>
            <Text style={styles.backText}>{'< Back'}</Text>
          </TouchableOpacity>
          <Text style={styles.kicker}>NSRP PROFILE</Text>
          <Text style={styles.headerTitle}>Profile and Skills</Text>
          <Text style={styles.headerSub}>Encode your NSRP-based information for job application support.</Text>
        </View>

        <View style={styles.body}>
          <Card style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>Your NSRP-Based Profile</Text>
            <Text style={styles.noticeText}>
              This one profile is used for every job you apply to. PESO verifies it once; after that you can apply to any job with PESO referral in one tap.
            </Text>
            <Button testID="profile-upload-shortcut" title="Use OCR Assistant" variant="secondary" onPress={() => router.push('/(seeker)/upload-nsrp')} />
          </Card>

          <Card style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>PESO Verification</Text>
            <View style={styles.nsrpStatusRow}>
              <StatusBadge status={nsrp.status as any} />
            </View>
            <Text style={styles.noticeText}>{nsrpStatusMessage(nsrp.status)}</Text>
            {!!nsrp.notes && <Text style={styles.pesoNote}>PESO note: {nsrp.notes}</Text>}
            {['not_submitted', 'needs_revision'].includes(nsrp.status) && (
              <TouchableOpacity
                testID="nsrp-certify"
                onPress={() => setCertified((c) => !c)}
                activeOpacity={0.8}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: certified }}
                style={styles.certifyRow}
              >
                <View style={[styles.checkbox, certified && styles.checkboxOn]}>
                  {certified && <Text style={styles.checkMark}>✓</Text>}
                </View>
                <Text style={styles.certifyText}>
                  I certify that all data/information I have provided are true to the best of my knowledge. I authorize
                  DOLE to include my profile in the PESO Employment Information System (PhilJobNet), and I understand
                  that my name may be made available to employers with access to the registry.
                </Text>
              </TouchableOpacity>
            )}
            {['not_submitted', 'needs_revision'].includes(nsrp.status) && (
              <Button
                testID="submit-nsrp"
                title={nsrp.status === 'needs_revision' ? 'Save and Resubmit to PESO' : 'Save and Submit to PESO'}
                onPress={handleSubmitToPeso}
                loading={submitting}
                disabled={missingReferralFields.length > 0 || !certified}
                style={{ marginTop: Spacing.md }}
              />
            )}
          </Card>

          <Card style={missingReferralFields.length ? styles.requirementsCard : styles.readyCard}>
            <Text style={styles.noticeTitle}>Required NSRP Items</Text>
            <Text style={styles.noticeText}>
              {filledReferralCount}/{requiredReferralCount} required items complete.
            </Text>
            {missingReferralFields.length > 0 ? (
              <>
                <Text style={styles.requirementsIntro}>Complete these before submitting to PESO:</Text>
                {missingReferralFields.slice(0, 8).map((field) => (
                  <Text key={field} style={styles.missingItem}>- {field}</Text>
                ))}
                {missingReferralFields.length > 8 && (
                  <Text style={styles.missingItem}>- {missingReferralFields.length - 8} more required item(s)</Text>
                )}
              </>
            ) : (
              <Text style={styles.readyText}>All required items are filled in.</Text>
            )}
          </Card>

          <NsrpForm
            value={{ ...form, nsrp_full_data: nsrpFullData }}
            onChange={(next) => {
              const { nsrp_full_data: nextFull, ...base } = next;
              setForm(base);
              setNsrpFullData(nextFull as any);
            }}
            idPrefix="prof"
          />

          <ProfileSection title="Additional Information (not on the NSRP form)">
            <Input testID="prof-exp" label="Years of Work Experience" value={form.years_of_experience} onChangeText={(v) => setField('years_of_experience', v)} keyboardType="number-pad" />
          </ProfileSection>

          <ProfileSection title="Skills">
            <Text style={styles.help}>Tap to select skills you have. These are used for rule-based job matching only.</Text>
            {Object.keys(skillsByCategory).sort().map((cat) => (
              <View key={cat} style={{ marginTop: Spacing.sm }}>
                <Text style={styles.catLabel}>{cat}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {skillsByCategory[cat].map((sk) => (
                    <Chip
                      key={sk.id}
                      testID={`skill-${sk.id}`}
                      label={sk.skill_name}
                      active={selectedSkills.has(sk.id)}
                      onPress={() => toggleSkill(sk.id)}
                    />
                  ))}
                </View>
              </View>
            ))}
          </ProfileSection>

          <View style={{ marginVertical: Spacing.md }}>
            <Button testID="prof-save" title="Save Profile" onPress={handleSave} loading={saving} />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Older profiles stored free-text answers ("Yes", "NO"); align them with the yes/no selectors.
function normalizeYesNo(full: typeof defaultNsrpFullData) {
  const next = { ...full };
  (['looking_for_work', 'willing_to_work_immediately', 'four_ps_beneficiary'] as const).forEach((key) => {
    const v = String(next[key] ?? '').trim().toLowerCase();
    if (v === 'yes' || v === 'no') next[key] = v;
  });
  return next;
}

function parseFullData(value: any) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card style={styles.sectionCard}>
      <Text style={styles.formTitle}>{title}</Text>
      {children}
    </Card>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.lightBg },
  content: { paddingBottom: Spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.lightBg },
  loadingText: { color: Colors.textDark, fontSize: FontSize.md },
  header: {
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  backButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginBottom: Spacing.sm },
  backText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '900' },
  kicker: { color: Colors.cardHighlight, fontSize: FontSize.xs, fontWeight: '900' },
  headerTitle: { color: Colors.white, fontSize: FontSize.xl, fontWeight: '900', marginTop: 4 },
  headerSub: { color: Colors.cardHighlight, fontSize: FontSize.sm, lineHeight: 20, marginTop: 8 },
  body: { padding: Spacing.md },
  noticeCard: { backgroundColor: Colors.cardHighlight },
  noticeTitle: { fontSize: FontSize.md, fontWeight: '900', color: Colors.textDark, marginBottom: 6 },
  noticeText: { fontSize: FontSize.sm, color: Colors.gray, lineHeight: 20, marginBottom: Spacing.md },
  requirementsCard: { backgroundColor: '#FEF3C7', borderColor: Colors.warning, borderWidth: 1, marginTop: Spacing.sm, marginBottom: Spacing.md },
  readyCard: { backgroundColor: Colors.cardHighlight, borderColor: Colors.primarySoft, borderWidth: 1, marginTop: Spacing.sm, marginBottom: Spacing.md },
  requirementsIntro: { fontSize: FontSize.xs, color: '#92400E', fontWeight: '900', marginBottom: 6 },
  missingItem: { fontSize: FontSize.xs, color: '#92400E', lineHeight: 18, fontWeight: '700' },
  nsrpStatusRow: { flexDirection: 'row', marginBottom: Spacing.sm },
  pesoNote: { color: '#92400E', fontSize: FontSize.sm, fontWeight: '700', lineHeight: 20, marginTop: Spacing.sm },
  certifyRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', marginTop: Spacing.md },
  checkbox: {
    width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white, marginTop: 2,
  },
  checkboxOn: { backgroundColor: Colors.primary },
  checkMark: { color: Colors.white, fontWeight: '900', fontSize: FontSize.sm },
  certifyText: { flex: 1, fontSize: FontSize.xs, color: Colors.textDark, lineHeight: 18 },
  readyText: { fontSize: FontSize.xs, color: Colors.primaryDark, lineHeight: 18, fontWeight: '900' },
  sectionCard: { marginBottom: Spacing.md, borderRadius: Radius.lg },
  formTitle: { fontSize: FontSize.md, fontWeight: '900', color: Colors.textDark, marginBottom: Spacing.md },
  help: { fontSize: FontSize.xs, color: Colors.gray, marginBottom: 4, lineHeight: 18 },
  catLabel: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '900', marginBottom: 6, textTransform: 'uppercase' },
  selectLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark, marginBottom: 6 },
  optBtn: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 7, marginRight: 6, marginBottom: 6 },
  twoColumn: { flexDirection: 'row' },
});
