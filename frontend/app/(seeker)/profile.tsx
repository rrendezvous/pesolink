// ============================================================
// NSRP Profile + Skills Management (combined screen)
// ============================================================
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, KeyboardAvoidingView, Platform, BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useNavigation } from 'expo-router';
import { Button, Input, Card, Chip, StatusBadge } from '../../src/components/ui';
import { NsrpForm } from '../../src/components/NsrpForm';
import { api, getApiError } from '../../src/api/client';
import { nsrpStatusMessage, sentBackMessage } from '../../src/utils/referral';
import { Colors, Spacing, FontSize, Radius, StatusColors } from '../../src/constants/theme';
import { orderSkillCategories } from '../../src/utils/skills';
import { setUnsavedChangesGuard, confirmLeave, hasUnsavedChanges } from '../../src/utils/unsavedChanges';


// Everything Save Profile stores (profile fields, NSRP form data, selected skills), as one comparable value.
const profileSnapshot = (form: any, fullData: any, skills: Set<number>) =>
  JSON.stringify([form, fullData, Array.from(skills).sort((a, b) => a - b)]);

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
  // Required items PESO's records count for the saved profile (what Home shows), to flag unsaved changes.
  const [savedFilled, setSavedFilled] = useState<number | null>(null);
  const [nsrp, setNsrp] = useState<{ status: string; notes?: string | null }>({ status: 'not_submitted' });
  const [submitting, setSubmitting] = useState(false);
  const [certified, setCertified] = useState(false);
  // Set when the profile could not be loaded: the form is hidden so a blank or outdated form is never saved
  // over the saved profile (saving replaces every field and the skills list).
  const [loadError, setLoadError] = useState('');

  const goToDashboard = () => {
    router.replace('/(seeker)/dashboard');
  };

  // Reload on every focus: this tab stays mounted, so returning from the OCR Assistant (which saves
  // straight to the profile) would otherwise show the old form, and saving it would overwrite the OCR data.
  // Every load shows "Loading..." in place of the form, so the previous values cannot be saved while fresh data
  // is on its way. Replies from an older load, or arriving after leaving the screen, are ignored.
  const loadToken = useRef(0);
  // What was last loaded or saved; null while loading or after the user chose to discard their edits.
  const savedSnapshot = useRef<string | null>(null);
  const loadProfile = useCallback(() => {
    savedSnapshot.current = null;
    const token = ++loadToken.current;
    const active = () => token === loadToken.current;
    setLoadError('');
    setLoading(true);
    (async () => {
      try {
        const [p, s] = await Promise.all([
          api.get('/job-seeker/profile'),
          api.get('/skills'),
        ]);
        if (!active()) return;
        const prof = p.data.profile;
        setSavedFilled(p.data.referral_requirements?.filled_count ?? null);
        const parsedFullData = parseFullData(prof.nsrp_full_data);
        const loadedForm = {
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
        };
        const loadedFullData = normalizeYesNo({ ...defaultNsrpFullData, ...parsedFullData });
        const loadedSkills = new Set<number>((p.data.skills || []).map((sk: any) => sk.id));
        setForm(loadedForm);
        setNsrpFullData(loadedFullData);
        setAllSkills(s.data.skills);
        setSelectedSkills(loadedSkills);
        savedSnapshot.current = profileSnapshot(loadedForm, loadedFullData, loadedSkills);
        setNsrp({ status: prof.nsrp_status || 'not_submitted', notes: prof.nsrp_review_notes });
      } catch (err) {
        if (active()) setLoadError(getApiError(err));
      } finally {
        if (active()) setLoading(false);
      }
    })();
  }, []);

  useFocusEffect(useCallback(() => {
    loadProfile();
    return () => { loadToken.current += 1; };
  }, [loadProfile]));

  // Warning before leaving with unsaved edits (tab bar, Back, OCR Assistant link). Nothing is saved
  // automatically; choosing to leave drops the edits, and the profile reloads from the server on return.
  const latest = useRef({ form, nsrpFullData, selectedSkills });
  useEffect(() => { latest.current = { form, nsrpFullData, selectedSkills }; });
  const navigation = useNavigation();
  useFocusEffect(useCallback(() => {
    setUnsavedChangesGuard({
      hasUnsavedChanges: () => savedSnapshot.current !== null
        && profileSnapshot(latest.current.form, latest.current.nsrpFullData, latest.current.selectedSkills) !== savedSnapshot.current,
      // Discarding also reloads the saved profile, so the edits are gone even if the user stays
      // (e.g. cancels the sign-out box). When leaving, this reply is ignored and the profile reloads on return.
      discard: () => { savedSnapshot.current = null; loadProfile(); },
    });
    // Nothing unsaved: Back works as usual. Unsaved: show the warning instead.
    const onBack = () => {
      if (!hasUnsavedChanges()) return false;
      confirmLeave(() => {
        if (navigation.canGoBack()) navigation.goBack();
        else router.navigate('/(seeker)/dashboard');
      });
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => {
      sub.remove();
      setUnsavedChangesGuard(null);
    };
  }, [navigation, router, loadProfile]));

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
    const sent = profileSnapshot(form, nsrpFullData, selectedSkills);
    const res = await api.post('/job-seeker/profile', {
        ...form,
        years_of_experience: parseInt(form.years_of_experience, 10) || 0,
        nsrp_full_data: nsrpFullData,
      });
    const skillsRes = await api.post('/job-seeker/skills', {
      skills: Array.from(selectedSkills).map((id) => ({ skill_id: id, proficiency_level: 'intermediate' })),
    });
    // Saved: these values no longer count as unsaved (edits made while saving still do).
    savedSnapshot.current = sent;
    const changedTo = res.data.nsrp_status_changed_to || skillsRes.data.nsrp_status_changed_to || null;
    if (changedTo) setNsrp({ status: changedTo, notes: null });
    const fresh = await api.get('/job-seeker/profile');
    setSavedFilled(fresh.data.referral_requirements?.filled_count ?? null);
    return changedTo;
  };


  const handleSubmitToPeso = async () => {
    // Only after a successful load, and one save at a time: Save and Submit both replace the saved profile and skills.
    if (loading || loadError || saving || submitting) return;
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
    // Only after a successful load, and one save at a time: Save and Submit both replace the saved profile and skills.
    if (loading || loadError || saving || submitting) return;
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

  if (loadError) {
    return (
      <View style={[styles.container, styles.errorWrap]}>
        <Card>
          <Text style={styles.errorTitle}>Could not load your profile</Text>
          <Text testID="prof-load-error" style={styles.errorText}>
            Nothing was changed. Check the connection and try again. ({loadError})
          </Text>
          <Button testID="prof-retry" title="Try Again" onPress={loadProfile} />
        </Card>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.kicker}>NSRP PROFILE</Text>
          <Text style={styles.headerTitle}>Profile and Skills</Text>
          <Text style={styles.headerSub}>
            Fill in your NSRP Form 1. PESO verifies it once; after that you can apply to any job with PESO referral.
          </Text>
        </View>

        <View style={styles.body}>
          {/* One status card: verification, required items, PESO note, then certify and submit. */}
          <Card style={styles.statusCard} testID="profile-status-card">
            <View style={styles.statusHead}>
              <Text style={styles.noticeTitle}>PESO Verification</Text>
              <StatusBadge status={nsrp.status as any} />
            </View>
            <Text style={styles.noticeText}>{nsrpStatusMessage(nsrp.status)}</Text>
            {!!nsrp.notes && (
              <Text style={[styles.pesoNote, nsrp.status !== 'needs_revision' && styles.pesoNoteNeutral]}>
                PESO note: {nsrp.notes}
              </Text>
            )}

            <View style={styles.progressHead}>
              <Text style={styles.progressLabel}>Required NSRP items</Text>
              <Text style={[styles.progressCount, missingReferralFields.length === 0 && styles.progressCountDone]}>
                {filledReferralCount}/{requiredReferralCount}
              </Text>
            </View>
            {savedFilled !== null && savedFilled !== filledReferralCount && (
              <Text testID="unsaved-progress-note" style={styles.unsavedNote}>
                Not saved yet: Home shows {savedFilled}/{requiredReferralCount} until you tap Save Profile.
              </Text>
            )}
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.round((filledReferralCount / requiredReferralCount) * 100)}%` },
                  missingReferralFields.length > 0 && styles.progressFillPartial,
                ]}
              />
            </View>
            {missingReferralFields.length > 0 ? (
              <View style={styles.missingBox}>
                <Text style={styles.requirementsIntro}>Complete these before submitting to PESO:</Text>
                {missingReferralFields.slice(0, 8).map((field) => (
                  <Text key={field} style={styles.missingItem}>- {field}</Text>
                ))}
                {missingReferralFields.length > 8 && (
                  <Text style={styles.missingItem}>- {missingReferralFields.length - 8} more required item(s)</Text>
                )}
              </View>
            ) : (
              <Text style={styles.readyText}>All required items are filled in.</Text>
            )}

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
                  This is to certify that all data/information that I have provided in this form are true to the best
                  of my knowledge. This is also to authorize the DOLE to include my profile in the PESO Employment
                  Information System, which is a subsystem of the PhilJobNet. It is understood that my name shall be
                  made available to employers who have access to the Registry. I am also aware that DOLE is not obliged
                  to seek employment on my behalf.
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

            <TouchableOpacity
              testID="profile-upload-shortcut"
              onPress={() => confirmLeave(() => router.push('/(seeker)/upload-nsrp'))}
              style={styles.ocrLink}
              accessibilityRole="button"
            >
              <Ionicons name="scan-outline" size={18} color={Colors.primary} />
              <Text style={styles.ocrLinkText}>Fill from a scanned NSRP form (OCR Assistant, optional)</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
            </TouchableOpacity>
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
            {orderSkillCategories(Object.keys(skillsByCategory)).map((cat) => (
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
  errorWrap: { padding: Spacing.md, justifyContent: 'center' },
  errorTitle: { fontSize: FontSize.md, fontWeight: '900', color: Colors.textDark, marginBottom: Spacing.sm },
  errorText: { fontSize: FontSize.sm, color: Colors.gray, lineHeight: 20, marginBottom: Spacing.md },
  header: {
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  statusCard: { marginBottom: Spacing.md },
  statusHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm, marginBottom: 4 },
  pesoNoteNeutral: { color: Colors.textSecondary },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.md },
  progressLabel: { color: Colors.textDark, fontSize: FontSize.sm, fontWeight: '800' },
  progressCount: { color: '#92400E', fontSize: FontSize.sm, fontWeight: '900', fontVariant: ['tabular-nums'] },
  progressCountDone: { color: Colors.primary },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: Colors.borderSoft, marginTop: 6, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  progressFillPartial: { backgroundColor: '#D97706' },
  missingBox: { backgroundColor: '#FEF3C7', borderRadius: Radius.md, padding: Spacing.sm, marginTop: Spacing.sm },
  ocrLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderTopColor: Colors.borderSoft,
    borderTopWidth: 1,
    paddingTop: Spacing.md,
    marginTop: Spacing.md,
  },
  ocrLinkText: { flex: 1, color: Colors.primary, fontSize: FontSize.sm, fontWeight: '800' },
  kicker: { color: Colors.cardHighlight, fontSize: FontSize.xs, fontWeight: '900' },
  headerTitle: { color: Colors.white, fontSize: FontSize.xl, fontWeight: '900', marginTop: 4 },
  headerSub: { color: Colors.cardHighlight, fontSize: FontSize.sm, lineHeight: 20, marginTop: 8 },
  body: { padding: Spacing.md },
  noticeCard: { backgroundColor: Colors.cardHighlight },
  noticeTitle: { fontSize: FontSize.md, fontWeight: '900', color: Colors.textDark, marginBottom: 6 },
  noticeText: { fontSize: FontSize.sm, color: Colors.gray, lineHeight: 20, marginBottom: Spacing.md },
  requirementsCard: { backgroundColor: '#FEF3C7', borderColor: Colors.warning, borderWidth: 1, marginTop: Spacing.sm, marginBottom: Spacing.md },
  readyCard: { backgroundColor: Colors.cardHighlight, borderColor: Colors.primarySoft, borderWidth: 1, marginTop: Spacing.sm, marginBottom: Spacing.md },
  unsavedNote: { fontSize: FontSize.xs, color: StatusColors.needs_revision.text, marginBottom: Spacing.xs },
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
