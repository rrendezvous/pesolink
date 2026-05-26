// ============================================================
// Job Form - Create / Edit Job Post
// ============================================================
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Button, Input, Card, Chip } from '../../src/components/ui';
import { api, getApiError } from '../../src/api/client';
import { Colors, Spacing, FontSize, Radius } from '../../src/constants/theme';

const JOB_TYPES = ['full-time', 'part-time', 'contract', 'temporary'];

export default function JobForm() {
  const router = useRouter();
  const { jobId } = useLocalSearchParams<{ jobId?: string }>();
  const isEdit = !!jobId;

  const [form, setForm] = useState<any>({
    job_title: '', job_description: '', job_type: 'full-time',
    salary_min: '', salary_max: '', location: 'Cagayan de Oro City',
    vacancies: '1', requirements: '', closing_date: '',
  });
  const [allSkills, setAllSkills] = useState<any[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const sk = await api.get('/skills');
        setAllSkills(sk.data.skills);

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
            closing_date: job.closing_date ? new Date(job.closing_date).toISOString().split('T')[0] : '',
          });
          setSelectedSkills(new Set((job.required_skills || []).map((s: any) => s.id)));
        }
      } catch (err) {
        Alert.alert('Error', getApiError(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [jobId]);

  const setField = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const toggleSkill = (id: number) => {
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!form.job_title || !form.job_description) {
      Alert.alert('Required', 'Job title and description are required.');
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

  const skillsByCategory: Record<string, any[]> = {};
  for (const sk of allSkills) {
    const cat = sk.category || 'Other';
    if (!skillsByCategory[cat]) skillsByCategory[cat] = [];
    skillsByCategory[cat].push(sk);
  }

  if (loading) return <View style={styles.center}><Text style={styles.loadingText}>Loading...</Text></View>;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.kicker}>EMPLOYER JOB POST</Text>
          <Text style={styles.headerTitle}>{isEdit ? 'Update Job' : 'Post New Job'}</Text>
          <Text style={styles.headerSub}>Create structured vacancies for PESO job seeker application tracking.</Text>
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
            {Object.keys(skillsByCategory).sort().map((cat) => (
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
  help: { fontSize: FontSize.xs, color: Colors.gray, marginBottom: 4, lineHeight: 18 },
  twoColumn: { flexDirection: 'row' },
  sectionCard: { marginBottom: Spacing.md, borderRadius: Radius.lg },
});
