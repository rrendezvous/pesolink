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
  const [allSkills, setAllSkills] = useState<any[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<Set<number>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const [p, s] = await Promise.all([
          api.get('/job-seeker/profile'),
          api.get('/skills'),
        ]);
        const prof = p.data.profile;
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
      await api.post('/job-seeker/profile', {
        ...form,
        years_of_experience: parseInt(form.years_of_experience, 10) || 0,
      });
      await api.post('/job-seeker/skills', {
        skills: Array.from(selectedSkills).map((id) => ({ skill_id: id, proficiency_level: 'intermediate' })),
      });
      Alert.alert('Saved', 'Profile updated successfully.', [
        { text: 'OK', onPress: () => router.back() },
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

  if (loading) {
    return <View style={styles.center}><Text>Loading...</Text></View>;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={styles.formTitle}>Personal Information (NSRP)</Text>
          <Input testID="prof-first" label="First Name *" value={form.first_name} onChangeText={(v) => setField('first_name', v)} autoCapitalize="words" />
          <Input testID="prof-middle" label="Middle Name" value={form.middle_name} onChangeText={(v) => setField('middle_name', v)} autoCapitalize="words" />
          <Input testID="prof-last" label="Last Name *" value={form.last_name} onChangeText={(v) => setField('last_name', v)} autoCapitalize="words" />
          <Input testID="prof-dob" label="Date of Birth (YYYY-MM-DD)" value={form.date_of_birth} onChangeText={(v) => setField('date_of_birth', v)} placeholder="1998-05-15" />
          <SelectField label="Gender" options={GENDERS} value={form.gender} onSelect={(v) => setField('gender', v)} testID="prof-gender" />
          <SelectField label="Civil Status" options={CIVIL} value={form.civil_status} onSelect={(v) => setField('civil_status', v)} testID="prof-civil" />
          <Input testID="prof-contact" label="Contact Number" value={form.contact_number} onChangeText={(v) => setField('contact_number', v)} keyboardType="phone-pad" />
        </Card>

        <Card>
          <Text style={styles.formTitle}>Address</Text>
          <Input testID="prof-address" label="Address" value={form.address} onChangeText={(v) => setField('address', v)} multiline numberOfLines={2} />
          <Input testID="prof-city" label="City/Municipality" value={form.city} onChangeText={(v) => setField('city', v)} autoCapitalize="words" />
          <Input testID="prof-province" label="Province" value={form.province} onChangeText={(v) => setField('province', v)} autoCapitalize="words" />
        </Card>

        <Card>
          <Text style={styles.formTitle}>Education & Employment</Text>
          <Input testID="prof-edu" label="Education Level" value={form.education_level} onChangeText={(v) => setField('education_level', v)} placeholder="e.g., College Graduate" />
          <Input testID="prof-course" label="Course / Field" value={form.course} onChangeText={(v) => setField('course', v)} placeholder="e.g., BS Information Technology" />
          <Input testID="prof-exp" label="Years of Experience" value={form.years_of_experience} onChangeText={(v) => setField('years_of_experience', v.replace(/[^0-9]/g, ''))} keyboardType="numeric" />
          <SelectField label="Employment Status" options={EMPLOYMENT} value={form.employment_status} onSelect={(v) => setField('employment_status', v)} testID="prof-empstatus" />
          <Input testID="prof-occupation" label="Preferred Occupation" value={form.preferred_occupation} onChangeText={(v) => setField('preferred_occupation', v)} placeholder="e.g., Software Developer" autoCapitalize="words" />
        </Card>

        <Card>
          <Text style={styles.formTitle}>Skills</Text>
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
        </Card>

        <View style={{ marginVertical: Spacing.md }}>
          <Button testID="prof-save" title="Save Profile" onPress={handleSave} loading={saving} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
            style={[
              styles.optBtn,
              { backgroundColor: value === opt ? Colors.primary : Colors.white, borderColor: value === opt ? Colors.primary : Colors.border },
            ]}
          >
            <Text style={{ color: value === opt ? Colors.white : Colors.textDark, fontSize: FontSize.sm, textTransform: 'capitalize' }}>
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.lightBg, padding: Spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  formTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark, marginBottom: Spacing.sm },
  help: { fontSize: FontSize.xs, color: Colors.gray, marginBottom: 4 },
  catLabel: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase' },
  selectLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 },
  optBtn: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6, marginBottom: 6 },
});
