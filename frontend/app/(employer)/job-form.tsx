// ============================================================
// Job Form - Create / Edit Job Post
// ============================================================
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Button, Input, Card, Chip, BackLink } from '../../src/components/ui';
import { api, getApiError } from '../../src/api/client';
import { todayKey } from '../../src/utils/jobs';
import { findSkillNamesInText, orderSkillCategories } from '../../src/utils/skills';
import { Colors, Spacing, FontSize, Radius } from '../../src/constants/theme';

const JOB_TYPES = ['full-time', 'part-time', 'contract', 'temporary'];
const BLANK_FORM = {
  job_title: '', job_description: '', job_type: 'full-time',
  salary_min: '', salary_max: '', location: 'Cagayan de Oro City',
  vacancies: '1', requirements: '', closing_date: '', application_email: '',
};

export default function JobForm() {
  const router = useRouter();
  const { jobId } = useLocalSearchParams<{ jobId?: string }>();
  const isEdit = !!jobId;

  const [form, setForm] = useState<any>(BLANK_FORM);
  const [allSkills, setAllSkills] = useState<any[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<Set<number>>(new Set());
  const [skillSearch, setSkillSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load on every focus: this hidden tab stays mounted, so editing the same job again would show the
  // values from before the last save (and saving would undo it), and a new post would keep old entries.
  useFocusEffect(useCallback(() => {
    (async () => {
      try {
        const sk = await api.get('/skills');
        setAllSkills(sk.data.skills);
        setSkillSearch('');
        if (!isEdit) {
          setForm(BLANK_FORM);
          setSelectedSkills(new Set());
        }

        if (isEdit) {
          setLoading(true);
          const j = await api.get(`/jobs/${jobId}`);
          const job = j.data.job;
          setForm({
            job_title: job.job_title || '',
            job_description: job.job_description || '',
            job_type: job.job_type || 'full-time',
            salary_min: job.salary_min != null ? String(job.salary_min) : '',
            salary_max: job.salary_max != null ? String(job.salary_max) : '',
            location: job.location || '',
            vacancies: String(job.vacancies || 1),
            requirements: job.requirements || '',
            application_email: job.application_email || '',
            closing_date: job.closing_date ? String(job.closing_date).slice(0, 10) : '',
          });
          setSelectedSkills(new Set((job.required_skills || []).map((s: any) => s.id)));
        }
      } catch (err) {
        Alert.alert('Error', getApiError(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [jobId, isEdit]));

  const setField = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const toggleSkill = (id: number) => {
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Suggestions are only shown; a skill is added when the employer taps it (or "Add all").
  const addSkills = (ids: number[]) => {
    setSelectedSkills((prev) => new Set([...prev, ...ids]));
  };

  const handleSave = async () => {
    if (!form.job_title.trim() || !form.job_description.trim()) {
      Alert.alert('Required', 'Job title and description are required.');
      return;
    }
    const salaryMin = form.salary_min ? parseFloat(form.salary_min) : null;
    const salaryMax = form.salary_max ? parseFloat(form.salary_max) : null;
    if (salaryMin !== null && salaryMax !== null && salaryMin > salaryMax) {
      Alert.alert('Check Salary', 'Salary Min cannot be higher than Salary Max.');
      return;
    }
    if (!isEdit && form.closing_date.trim() && form.closing_date.trim() < todayKey()) {
      Alert.alert('Check Closing Date', 'The closing date cannot be in the past.');
      return;
    }
    if (form.application_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.application_email.trim())) {
      Alert.alert('Invalid Email', 'Enter a valid application email, or leave it blank.');
      return;
    }

    setSaving(true);
    const payload = {
      job_title: form.job_title,
      job_description: form.job_description,
      job_type: form.job_type,
      salary_min: form.salary_min ? parseFloat(form.salary_min) : null,
      salary_max: form.salary_max ? parseFloat(form.salary_max) : null,
      location: form.location,
      vacancies: parseInt(form.vacancies, 10) || 1,
      requirements: form.requirements,
      application_email: form.application_email.trim(),
      closing_date: form.closing_date || null,
      required_skills: Array.from(selectedSkills).map((id) => ({ skill_id: id, required_level: 'beginner' })),
    };

    try {
      if (isEdit) {
        await api.put(`/employer/jobs/${jobId}`, payload);
      } else {
        await api.post('/employer/jobs', payload);
      }
      Alert.alert('Saved', `Job ${isEdit ? 'updated' : 'created'} successfully.`, [
        { text: 'OK', onPress: () => router.replace('/(employer)/manage-jobs') },
      ]);
    } catch (err) {
      Alert.alert('Error', getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const suggestedSkills = findSkillNamesInText(`${form.job_description}
${form.requirements}`, allSkills)
    .filter((sk) => !selectedSkills.has(sk.id));
  const selectedNames = allSkills.filter((sk) => selectedSkills.has(sk.id)).map((sk) => sk.skill_name);
  // The search only filters which chips are shown; selections hidden by it are kept and saved.
  const search = skillSearch.trim().toLowerCase();
  const visibleSkills = search ? allSkills.filter((sk) => String(sk.skill_name).toLowerCase().includes(search)) : allSkills;
  const skillsByCategory: Record<string, any[]> = {};
  for (const sk of visibleSkills) {
    const cat = sk.category || 'Other';
    if (!skillsByCategory[cat]) skillsByCategory[cat] = [];
    skillsByCategory[cat].push(sk);
  }

  if (loading) return <View style={styles.center}><Text style={styles.loadingText}>Loading...</Text></View>;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <BackLink
            testID="job-form-back"
            label="Back"
            onPress={() => (router.canGoBack() ? router.back() : router.navigate('/(employer)/manage-jobs'))}
          />
          <Text style={styles.kicker}>EMPLOYER JOB POST</Text>
          <Text style={styles.headerTitle}>{isEdit ? 'Update Job' : 'Post New Job'}</Text>
          <Text style={styles.headerSub}>Create structured vacancies for PESO referral routing and tracking.</Text>
        </View>

        <View style={styles.body}>
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Job Information</Text>
            <Input testID="job-title" label="Job Title *" value={form.job_title} onChangeText={(v) => setField('job_title', v)} placeholder="e.g., Software Developer" autoCapitalize="words" />
            <Input testID="job-desc" label="Job Description *" value={form.job_description} onChangeText={(v) => setField('job_description', v)} multiline numberOfLines={4} placeholder="Describe the role, responsibilities, environment..." />
            <Input
              testID="job-req"
              label="Requirements / Application Instructions"
              value={form.requirements}
              onChangeText={(v) => setField('requirements', v)}
              multiline
              numberOfLines={3}
              placeholder="Education, experience, documents, and how applicants should proceed..."
            />
            <Input
              testID="job-email"
              label="Application Email (optional)"
              value={form.application_email}
              onChangeText={(v) => setField('application_email', v)}
              keyboardType="email-address"
              placeholder="e.g., careers@company.ph"
            />
            <Text style={styles.helpText}>
              Shown to job seekers who prefer to apply directly. Direct email applications are outside PESO-Link tracking;
              Applicants with a PESO-verified NSRP profile reach you as PESO-Referred.
            </Text>

            <Text style={styles.label}>Job Type</Text>
            <View style={styles.chipWrap}>
              {JOB_TYPES.map((t) => (
                <Chip key={t} testID={`type-${t}`} label={t} active={form.job_type === t} onPress={() => setField('job_type', t)} />
              ))}
            </View>

            <Input testID="job-loc" label="Location" value={form.location} onChangeText={(v) => setField('location', v)} placeholder="e.g., Cagayan de Oro City" autoCapitalize="words" />
            <Input testID="job-vac" label="Vacancies" value={form.vacancies} onChangeText={(v) => setField('vacancies', v.replace(/[^0-9]/g, ''))} keyboardType="numeric" />

            <View style={styles.twoColumn}>
              <View style={{ flex: 1 }}>
                <Input testID="job-smin" label="Salary Min (PHP)" value={form.salary_min} onChangeText={(v) => setField('salary_min', v.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="15000" />
              </View>
              <View style={{ width: Spacing.sm }} />
              <View style={{ flex: 1 }}>
                <Input testID="job-smax" label="Salary Max (PHP)" value={form.salary_max} onChangeText={(v) => setField('salary_max', v.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="20000" />
              </View>
            </View>

            <Input testID="job-close" label="Closing Date (YYYY-MM-DD)" value={form.closing_date} onChangeText={(v) => setField('closing_date', v)} placeholder="optional" />
          </Card>

          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Required Skills</Text>
            <Text style={styles.help}>Used for rule-based matched and missing skill comparison only.</Text>

            {suggestedSkills.length > 0 && (
              <View testID="skill-suggestions" style={styles.suggestBox}>
                <Text style={styles.catLabel}>Found in your text</Text>
                <Text style={styles.help}>
                  Skill names from the skills list that appear in your description or requirements. Tap a skill to add it.
                </Text>
                <View style={styles.chipWrap}>
                  {suggestedSkills.map((sk) => (
                    <Chip key={sk.id} testID={`suggest-skill-${sk.id}`} label={`+ ${sk.skill_name}`} onPress={() => addSkills([sk.id])} />
                  ))}
                </View>
                {suggestedSkills.length > 1 && (
                  <Button
                    testID="suggest-add-all"
                    title={`Add all ${suggestedSkills.length}`}
                    variant="secondary"
                    onPress={() => addSkills(suggestedSkills.map((sk) => sk.id))}
                  />
                )}
              </View>
            )}

            <Text testID="selected-skills-summary" style={styles.selectedSummary}>
              {selectedNames.length ? `Selected (${selectedNames.length}): ${selectedNames.join(', ')}` : 'No skills selected yet.'}
            </Text>
            <Input testID="skill-search" label="Search skills" value={skillSearch} onChangeText={setSkillSearch} placeholder="e.g., welding" />
            {search && visibleSkills.length === 0 && <Text style={styles.help}>No skills match your search.</Text>}
            {orderSkillCategories(Object.keys(skillsByCategory)).map((cat) => (
              <View key={cat} style={{ marginTop: Spacing.sm }}>
                <Text style={styles.catLabel}>{cat}</Text>
                <View style={styles.chipWrap}>
                  {skillsByCategory[cat].map((sk) => (
                    <Chip key={sk.id} testID={`req-skill-${sk.id}`} label={sk.skill_name} active={selectedSkills.has(sk.id)} onPress={() => toggleSkill(sk.id)} />
                  ))}
                </View>
              </View>
            ))}
          </Card>

          <View style={{ marginVertical: Spacing.md }}>
            <Button testID="save-job" title={isEdit ? 'Update Job' : 'Post Job'} onPress={handleSave} loading={saving} />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  helpText: { fontSize: FontSize.xs, color: Colors.gray, lineHeight: 18, marginTop: -8, marginBottom: Spacing.md },
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
  kicker: { color: Colors.cardHighlight, fontSize: FontSize.xs, fontWeight: '900' },
  headerTitle: { color: Colors.white, fontSize: FontSize.xl, fontWeight: '900', marginTop: 4 },
  headerSub: { color: Colors.cardHighlight, fontSize: FontSize.sm, lineHeight: 20, marginTop: 8 },
  body: { padding: Spacing.md },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '900', color: Colors.textDark, marginBottom: Spacing.md },
  label: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark, marginBottom: 6 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: Spacing.sm },
  catLabel: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '900', marginBottom: 6, textTransform: 'uppercase' },
  suggestBox: {
    borderWidth: 1, borderColor: Colors.borderSoft, borderRadius: Radius.md,
    padding: Spacing.sm, marginTop: Spacing.sm, marginBottom: Spacing.sm, backgroundColor: Colors.lightBg,
  },
  selectedSummary: { fontSize: FontSize.sm, color: Colors.textDark, fontWeight: '700', marginVertical: Spacing.sm, lineHeight: 20 },
  help: { fontSize: FontSize.xs, color: Colors.gray, marginBottom: 4, lineHeight: 18 },
  twoColumn: { flexDirection: 'row' },
  sectionCard: { marginBottom: Spacing.md, borderRadius: Radius.lg },
});
