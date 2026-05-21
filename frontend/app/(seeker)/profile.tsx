// ============================================================
// NSRP Profile + Skills Management (combined screen)
// ============================================================
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Input, Card, Chip } from '../../src/components/ui';
import { api, getApiError } from '../../src/api/client';
import { Colors, Spacing, FontSize } from '../../src/constants/theme';

const GENDERS = ['male', 'female', 'other'];
const CIVIL = ['single', 'married', 'widowed', 'separated'];
const EMPLOYMENT = ['unemployed', 'underemployed', 'employed'];

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

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [referralStatus, setReferralStatus] = useState('draft');
  const [reviewNotes, setReviewNotes] = useState('');
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
        setNsrpFullData({ ...defaultNsrpFullData, ...parsedFullData });
        setReferralStatus(prof.referral_status || 'draft');
        setReviewNotes(prof.referral_review_notes || '');
        setAllSkills(s.data.skills);
        setSelectedSkills(new Set((p.data.skills || []).map((sk: any) => sk.id)));
      } catch (err) {
        Alert.alert('Error', getApiError(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setField = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const setFullDataField = (k: keyof typeof defaultNsrpFullData, v: string) => (
    setNsrpFullData((f) => ({ ...f, [k]: v }))
  );

  const toggleSkill = (id: number) => {
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!form.first_name || !form.last_name) {
      Alert.alert('Required', 'First and last name are required.');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/job-seeker/profile', {
        ...form,
        years_of_experience: parseInt(form.years_of_experience, 10) || 0,
        nsrp_full_data: nsrpFullData,
      });
      setReferralStatus(res.data.profile?.referral_status || 'draft');
      setReviewNotes(res.data.profile?.referral_review_notes || '');
      await api.post('/job-seeker/skills', {
        skills: Array.from(selectedSkills).map((id) => ({ skill_id: id, proficiency_level: 'intermediate' })),
      });
      Alert.alert('Saved', 'Profile updated successfully.', [
        { text: 'OK', onPress: goToDashboard },
      ]);
    } catch (err) {
      Alert.alert('Error', getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const submitForReview = async () => {
    setSubmitting(true);
    try {
      const res = await api.post('/job-seeker/profile/submit-referral');
      setReferralStatus(res.data.referral_status || 'submitted');
      setReviewNotes('');
      Alert.alert('Submitted', 'Your NSRP profile has been submitted for PESO review.');
    } catch (err) {
      Alert.alert('Submit Failed', getApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const skillsByCategory: Record<string, any[]> = {};
  for (const sk of allSkills) {
    const cat = sk.category || 'Other';
    if (!skillsByCategory[cat]) skillsByCategory[cat] = [];
    skillsByCategory[cat].push(sk);
  }

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
            <Text style={styles.noticeTitle}>Referral Status: {getReferralLabel(referralStatus)}</Text>
            <Text style={styles.noticeText}>
              {getReferralHelp(referralStatus)}
            </Text>
            {!!reviewNotes && <Text style={styles.reviewNotes}>PESO note: {reviewNotes}</Text>}
            <Button testID="profile-upload-shortcut" title="Use OCR Assistant" variant="secondary" onPress={() => router.push('/(seeker)/upload-nsrp')} />
          </Card>

          <ProfileSection title="Personal Information">
            <Input testID="prof-first" label="First Name *" value={form.first_name} onChangeText={(v) => setField('first_name', v)} autoCapitalize="words" />
            <Input testID="prof-middle" label="Middle Name" value={form.middle_name} onChangeText={(v) => setField('middle_name', v)} autoCapitalize="words" />
            <Input testID="prof-last" label="Last Name *" value={form.last_name} onChangeText={(v) => setField('last_name', v)} autoCapitalize="words" />
            <Input testID="prof-suffix" label="Suffix" value={nsrpFullData.suffix} onChangeText={(v) => setFullDataField('suffix', v)} placeholder="e.g., Jr., III" />
            <Input testID="prof-dob" label="Date of Birth (YYYY-MM-DD)" value={form.date_of_birth} onChangeText={(v) => setField('date_of_birth', v)} placeholder="1998-05-15" />
            <Input testID="prof-birthplace" label="Place of Birth" value={nsrpFullData.place_of_birth} onChangeText={(v) => setFullDataField('place_of_birth', v)} autoCapitalize="words" />
            <SelectField label="Gender" options={GENDERS} value={form.gender} onSelect={(v) => setField('gender', v)} testID="prof-gender" />
            <SelectField label="Civil Status" options={CIVIL} value={form.civil_status} onSelect={(v) => setField('civil_status', v)} testID="prof-civil" />
            <Input testID="prof-religion" label="Religion" value={nsrpFullData.religion} onChangeText={(v) => setFullDataField('religion', v)} autoCapitalize="words" />
            <Input testID="prof-contact" label="Contact Number" value={form.contact_number} onChangeText={(v) => setField('contact_number', v)} keyboardType="phone-pad" />
            <Input testID="prof-email-address" label="Email Address" value={nsrpFullData.email_address} onChangeText={(v) => setFullDataField('email_address', v)} keyboardType="email-address" />
            <View style={styles.twoColumn}>
              <View style={{ flex: 1 }}>
                <Input testID="prof-landline" label="Landline Number" value={nsrpFullData.landline_number} onChangeText={(v) => setFullDataField('landline_number', v)} />
              </View>
              <View style={{ width: Spacing.sm }} />
              <View style={{ flex: 1 }}>
                <Input testID="prof-cellphone" label="Cell Phone Number" value={nsrpFullData.cell_phone_number} onChangeText={(v) => setFullDataField('cell_phone_number', v)} keyboardType="phone-pad" />
              </View>
            </View>
          </ProfileSection>

          <ProfileSection title="Address">
            <Input testID="prof-address" label="Address" value={form.address} onChangeText={(v) => setField('address', v)} multiline numberOfLines={2} />
            <Input testID="prof-house-street" label="House No. / Street" value={nsrpFullData.house_street} onChangeText={(v) => setFullDataField('house_street', v)} />
            <Input testID="prof-village" label="Village" value={nsrpFullData.village} onChangeText={(v) => setFullDataField('village', v)} />
            <Input testID="prof-barangay" label="Barangay" value={nsrpFullData.barangay} onChangeText={(v) => setFullDataField('barangay', v)} />
            <Input testID="prof-city" label="City/Municipality" value={form.city} onChangeText={(v) => setField('city', v)} autoCapitalize="words" />
            <Input testID="prof-province" label="Province" value={form.province} onChangeText={(v) => setField('province', v)} autoCapitalize="words" />
          </ProfileSection>

          <ProfileSection title="Employment Status / Type">
            <SelectField label="Employment Status" options={EMPLOYMENT} value={form.employment_status} onSelect={(v) => setField('employment_status', v)} testID="prof-empstatus" />
            <Input testID="prof-employment-type" label="Employment Type" value={nsrpFullData.employment_type} onChangeText={(v) => setFullDataField('employment_type', v)} placeholder="e.g., wage employed, self-employed, fresh graduate, resigned" />
            <View style={styles.twoColumn}>
              <View style={{ flex: 1 }}>
                <Input testID="prof-looking-work" label="Actively Looking for Work?" value={nsrpFullData.looking_for_work} onChangeText={(v) => setFullDataField('looking_for_work', v)} placeholder="Yes / No" />
              </View>
              <View style={{ width: Spacing.sm }} />
              <View style={{ flex: 1 }}>
                <Input testID="prof-looking-duration" label="How Long Looking?" value={nsrpFullData.looking_duration} onChangeText={(v) => setFullDataField('looking_duration', v)} />
              </View>
            </View>
            <View style={styles.twoColumn}>
              <View style={{ flex: 1 }}>
                <Input testID="prof-willing-now" label="Willing to Work Immediately?" value={nsrpFullData.willing_to_work_immediately} onChangeText={(v) => setFullDataField('willing_to_work_immediately', v)} placeholder="Yes / No" />
              </View>
              <View style={{ width: Spacing.sm }} />
              <View style={{ flex: 1 }}>
                <Input testID="prof-available-when" label="If No, When?" value={nsrpFullData.available_when} onChangeText={(v) => setFullDataField('available_when', v)} />
              </View>
            </View>
            <View style={styles.twoColumn}>
              <View style={{ flex: 1 }}>
                <Input testID="prof-4ps" label="4Ps Beneficiary?" value={nsrpFullData.four_ps_beneficiary} onChangeText={(v) => setFullDataField('four_ps_beneficiary', v)} placeholder="Yes / No" />
              </View>
              <View style={{ width: Spacing.sm }} />
              <View style={{ flex: 1 }}>
                <Input testID="prof-household-id" label="Household ID No." value={nsrpFullData.household_id} onChangeText={(v) => setFullDataField('household_id', v)} />
              </View>
            </View>
          </ProfileSection>

          <ProfileSection title="Educational Background">
            <Input testID="prof-edu" label="Education Level" value={form.education_level} onChangeText={(v) => setField('education_level', v)} placeholder="e.g., College Graduate" />
            <Input testID="prof-course" label="Course / Field" value={form.course} onChangeText={(v) => setField('course', v)} placeholder="e.g., BS Information Technology" />
            <Text style={styles.help}>Summarize school, course, year graduated, undergraduate level, and awards per level.</Text>
            <Input testID="prof-elem-bg" label="Elementary" value={nsrpFullData.elementary_background} onChangeText={(v) => setFullDataField('elementary_background', v)} multiline numberOfLines={2} />
            <Input testID="prof-secondary-bg" label="Secondary" value={nsrpFullData.secondary_background} onChangeText={(v) => setFullDataField('secondary_background', v)} multiline numberOfLines={2} />
            <Input testID="prof-tertiary-bg" label="Tertiary" value={nsrpFullData.tertiary_background} onChangeText={(v) => setFullDataField('tertiary_background', v)} multiline numberOfLines={2} />
            <Input testID="prof-grad-bg" label="Graduate Studies" value={nsrpFullData.graduate_studies_background} onChangeText={(v) => setFullDataField('graduate_studies_background', v)} multiline numberOfLines={2} />
          </ProfileSection>

          <ProfileSection title="Job Preference">
            <Input testID="prof-occupation" label="Preferred Occupation" value={form.preferred_occupation} onChangeText={(v) => setField('preferred_occupation', v)} placeholder="e.g., Software Developer" autoCapitalize="words" />
            <Input testID="prof-pref-occupations" label="Preferred Occupations (1-4)" value={nsrpFullData.preferred_occupations} onChangeText={(v) => setFullDataField('preferred_occupations', v)} multiline numberOfLines={2} />
            <Input testID="prof-work-location" label="Preferred Work Location" value={nsrpFullData.preferred_work_location} onChangeText={(v) => setFullDataField('preferred_work_location', v)} placeholder="e.g., CDO, Tagoloan, Villanueva" />
            <Input testID="prof-local-locations" label="Local Cities/Municipalities" value={nsrpFullData.preferred_local_locations} onChangeText={(v) => setFullDataField('preferred_local_locations', v)} multiline numberOfLines={2} />
            <Input testID="prof-overseas-locations" label="Overseas Countries" value={nsrpFullData.preferred_overseas_locations} onChangeText={(v) => setFullDataField('preferred_overseas_locations', v)} multiline numberOfLines={2} />
            <View style={styles.twoColumn}>
              <View style={{ flex: 1 }}>
                <Input testID="prof-expected-salary" label="Expected Salary Range" value={nsrpFullData.expected_salary} onChangeText={(v) => setFullDataField('expected_salary', v)} />
              </View>
              <View style={{ width: Spacing.sm }} />
              <View style={{ flex: 1 }}>
                <Input testID="prof-passport" label="Passport No." value={nsrpFullData.passport_number} onChangeText={(v) => setFullDataField('passport_number', v)} />
              </View>
            </View>
            <Input testID="prof-passport-expiry" label="Passport Expiry Date" value={nsrpFullData.passport_expiry} onChangeText={(v) => setFullDataField('passport_expiry', v)} placeholder="YYYY-MM-DD" />
          </ProfileSection>

          <ProfileSection title="Language / Dialect Proficiency">
            <Text style={styles.help}>Indicate read/write/speak/understand ability for English, Filipino, and others.</Text>
            <Input testID="prof-language" label="Language / Dialect Summary" value={nsrpFullData.language_dialect} onChangeText={(v) => setFullDataField('language_dialect', v)} placeholder="e.g., Cebuano, Tagalog, English" />
            <Input testID="prof-language-prof" label="Read / Write / Speak / Understand" value={nsrpFullData.language_proficiency} onChangeText={(v) => setFullDataField('language_proficiency', v)} multiline numberOfLines={3} />
          </ProfileSection>

          <ProfileSection title="Technical/Vocational, Eligibility, and Work Experience">
            <Input testID="prof-exp" label="Years of Experience" value={form.years_of_experience} onChangeText={(v) => setField('years_of_experience', v.replace(/[^0-9]/g, ''))} keyboardType="numeric" />
            <Input testID="prof-trainings" label="Trainings / Seminars" value={nsrpFullData.trainings} onChangeText={(v) => setFullDataField('trainings', v)} multiline numberOfLines={3} />
            <Input testID="prof-eligibility" label="Eligibility / Licenses" value={nsrpFullData.eligibility_license} onChangeText={(v) => setFullDataField('eligibility_license', v)} multiline numberOfLines={2} />
            <Input testID="prof-workexp" label="Work Experience" value={nsrpFullData.work_experience} onChangeText={(v) => setFullDataField('work_experience', v)} multiline numberOfLines={4} />
          </ProfileSection>

          <ProfileSection title="Government IDs, Physical Details, and Other Skills">
            <View style={styles.twoColumn}>
              <View style={{ flex: 1 }}>
                <Input testID="prof-height" label="Height" value={nsrpFullData.height} onChangeText={(v) => setFullDataField('height', v)} placeholder="e.g., 165 cm" />
              </View>
              <View style={{ width: Spacing.sm }} />
              <View style={{ flex: 1 }}>
                <Input testID="prof-weight" label="Weight" value={nsrpFullData.weight} onChangeText={(v) => setFullDataField('weight', v)} placeholder="e.g., 60 kg" />
              </View>
            </View>
            <Input testID="prof-tin" label="TIN" value={nsrpFullData.tin} onChangeText={(v) => setFullDataField('tin', v)} />
            <Input testID="prof-gsis-sss" label="GSIS/SSS ID No." value={nsrpFullData.gsis_sss_no} onChangeText={(v) => setFullDataField('gsis_sss_no', v)} />
            <Input testID="prof-pagibig" label="PAG-IBIG No." value={nsrpFullData.pagibig_no} onChangeText={(v) => setFullDataField('pagibig_no', v)} />
            <Input testID="prof-philhealth" label="PhilHealth No." value={nsrpFullData.philhealth_no} onChangeText={(v) => setFullDataField('philhealth_no', v)} />
            <Input testID="prof-disability" label="Disability" value={nsrpFullData.disability} onChangeText={(v) => setFullDataField('disability', v)} placeholder="Visual, hearing, speech, physical, others, or none" />
            <Input testID="prof-disability-other" label="Disability - Others, Specify" value={nsrpFullData.disability_other} onChangeText={(v) => setFullDataField('disability_other', v)} />
            <Input testID="prof-other-skills-acquired" label="Other Skills Acquired Without Formal Training" value={nsrpFullData.other_skills_acquired} onChangeText={(v) => setFullDataField('other_skills_acquired', v)} placeholder="e.g., driver, computer literate, electrician" multiline numberOfLines={3} />
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
            <View style={{ height: Spacing.sm }} />
            <Button
              testID="submit-referral"
              title="Submit for PESO Review"
              variant="secondary"
              onPress={submitForReview}
              loading={submitting}
              disabled={referralStatus === 'submitted' || referralStatus === 'referral_ready'}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function getReferralLabel(status: string) {
  if (status === 'submitted') return 'Submitted for Review';
  if (status === 'needs_revision') return 'Needs Revision';
  if (status === 'referral_ready') return 'PESO Referral-Ready';
  return 'Draft';
}

function getReferralHelp(status: string) {
  if (status === 'submitted') return 'Your NSRP profile is waiting for PESO Admin review.';
  if (status === 'needs_revision') return 'PESO Admin requested updates. Edit your profile, save, then submit again.';
  if (status === 'referral_ready') return 'PESO reviewed your NSRP profile for referral support. This is not a hiring decision.';
  return 'Save your NSRP profile, then submit it for PESO review when ready.';
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

function SelectField({
  label, options, value, onSelect, testID,
}: { label: string; options: string[]; value: string; onSelect: (v: string) => void; testID?: string }) {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={styles.selectLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt}
            testID={`${testID}-${opt}`}
            onPress={() => onSelect(opt)}
            activeOpacity={0.75}
            style={[
              styles.optBtn,
              { backgroundColor: value === opt ? Colors.primary : Colors.white, borderColor: value === opt ? Colors.primary : Colors.border },
            ]}
          >
            <Text style={{ color: value === opt ? Colors.white : Colors.textDark, fontSize: FontSize.sm, textTransform: 'capitalize', fontWeight: '700' }}>
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
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
  reviewNotes: { fontSize: FontSize.sm, color: '#92400E', lineHeight: 20, marginBottom: Spacing.md, fontWeight: '700' },
  sectionCard: { marginBottom: Spacing.md },
  formTitle: { fontSize: FontSize.md, fontWeight: '900', color: Colors.textDark, marginBottom: Spacing.md },
  help: { fontSize: FontSize.xs, color: Colors.gray, marginBottom: 4, lineHeight: 18 },
  catLabel: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '900', marginBottom: 6, textTransform: 'uppercase' },
  selectLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark, marginBottom: 6 },
  optBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginRight: 6, marginBottom: 6 },
  twoColumn: { flexDirection: 'row' },
});
