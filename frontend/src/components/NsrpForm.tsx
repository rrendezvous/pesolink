// ============================================================
// NSRP Form 1 (DOLE, January 2017) - editable form shared by the profile screen and the OCR review.
// Sections and labels follow the official form (I-VIII). Tables are stored as structured rows in
// nsrp_full_data; the backend fills the older summary text fields from them.
// Structured keys are only written when the job seeker edits them, so profiles encoded before this
// structure keep their free-text answers ("Previously encoded") and are not marked as changed.
// ============================================================
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, Input } from './ui';
import { Colors, Spacing, FontSize, Radius } from '../constants/theme';

export const SEX_OPTIONS = [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }];
export const CIVIL_OPTIONS = [
  { value: 'single', label: 'Single' }, { value: 'married', label: 'Married' }, { value: 'widowed', label: 'Widowed' },
  { value: 'separated', label: 'Separated' }, { value: 'live-in', label: 'Live-in' },
];
export const EMPLOYMENT_STATUS_OPTIONS = [{ value: 'employed', label: 'Employed' }, { value: 'unemployed', label: 'Unemployed' }];
export const EMPLOYMENT_TYPE_OPTIONS: Record<string, { value: string; label: string }[]> = {
  employed: [
    { value: 'wage employed', label: 'Wage Employed' },
    { value: 'self employed', label: 'Self Employed' },
  ],
  unemployed: [
    { value: 'new entrant/fresh graduate', label: 'New Entrant/Fresh Graduate' },
    { value: 'finished contract', label: 'Finished Contract' },
    { value: 'resigned', label: 'Resigned' },
    { value: 'retired', label: 'Retired' },
    { value: 'terminated/laidoff(local)', label: 'Terminated/Laidoff (local)' },
    { value: 'terminated/laidoff(abroad)', label: 'Terminated/Laidoff (abroad)' },
    { value: 'others', label: 'Others' },
  ],
};
const YES_NO = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }];
const DISABILITIES = [
  { value: 'visual', label: 'Visual' }, { value: 'hearing', label: 'Hearing' },
  { value: 'speech', label: 'Speech' }, { value: 'physical', label: 'Physical' }, { value: 'others', label: 'Others' },
];
export const OTHER_SKILLS = [
  'Auto Mechanic', 'Beautician', 'Carpentry Work', 'Computer Literate', 'Domestic Chores', 'Driver',
  'Electrician', 'Embroidery', 'Gardening', 'Masonry', 'Painter/Artist', 'Painting Jobs',
  'Photography', 'Plumbing', 'Sewing Dresses', 'Stenography', 'Tailoring',
];
const EDUCATION_LEVELS = [
  { key: 'elementary', label: 'Elementary' }, { key: 'secondary', label: 'Secondary' },
  { key: 'tertiary', label: 'Tertiary' }, { key: 'graduate', label: 'Graduate Studies' },
];
const LANGUAGES = [{ key: 'english', label: 'English' }, { key: 'filipino', label: 'Filipino' }, { key: 'other', label: 'Others' }];
const LANGUAGE_SKILLS = [
  { key: 'read', label: 'Read' }, { key: 'write', label: 'Write' }, { key: 'speak', label: 'Speak' }, { key: 'understand', label: 'Understand' },
];

const has = (v: any) => String(v ?? '').trim().length > 0;
const anyRow = (rows: any) => Array.isArray(rows) && rows.some((r) => r && Object.values(r).some(has));

// Checklist items read from the stored summary text when the structured list was never edited.
function checkedFrom(list: string[] | undefined, legacy: string | undefined, options: string[]) {
  if (Array.isArray(list)) return list;
  const lowerLegacy = String(legacy || '').toLowerCase();
  return options.filter((o) => lowerLegacy.includes(o.toLowerCase()));
}

export type NsrpFormValue = Record<string, any> & { nsrp_full_data?: Record<string, any> };

export function NsrpForm({
  value, onChange, idPrefix = 'nsrp',
}: { value: NsrpFormValue; onChange: (next: NsrpFormValue) => void; idPrefix?: string }) {
  const full = value.nsrp_full_data || {};
  const setBase = (k: string, v: any) => onChange({ ...value, [k]: v });
  const setFull = (patch: Record<string, any>) => onChange({ ...value, nsrp_full_data: { ...full, ...patch } });
  const id = (s: string) => `${idPrefix}-${s}`;

  // --- helpers bound to this form ---
  // Called as a function (not <Text1 />) so the TextInput keeps focus while typing.
  const Text1 = ({ k, label, base, ...rest }: { k: string; label: string; base?: boolean; [x: string]: any }) => (
    <Input
      testID={id(k)}
      label={label}
      value={String((base ? value[k] : full[k]) ?? '')}
      onChangeText={(v) => (base ? setBase(k, v) : setFull({ [k]: v }))}
      {...rest}
    />
  );
  const list = (k: string, size: number) => {
    const arr = Array.isArray(full[k]) ? [...full[k]] : [];
    while (arr.length < size) arr.push('');
    return arr;
  };
  const setListItem = (k: string, size: number, i: number, v: string) => {
    const arr = list(k, size);
    arr[i] = v;
    setFull({ [k]: arr });
  };
  const rows = (k: string, size: number) => {
    const arr = Array.isArray(full[k]) ? full[k].map((r: any) => ({ ...r })) : [];
    while (arr.length < size) arr.push({});
    return arr;
  };
  const setRow = (k: string, size: number, i: number, field: string, v: string) => {
    const arr = rows(k, size);
    arr[i] = { ...arr[i], [field]: v };
    setFull({ [k]: arr });
  };
  const legacyBox = (show: boolean, k: string, label = 'Previously encoded (free text)') => (show && has(full[k]) ? (
    <Input testID={id(`legacy-${k}`)} label={label} value={String(full[k])} onChangeText={(v) => setFull({ [k]: v })} multiline numberOfLines={3} />
  ) : null);

  // --- checklists ---
  // Checked items are kept in the form's own order and an empty checklist is stored blank, so ticking and
  // unticking a box leaves the saved value exactly as it was (a verified profile is not sent back to PESO).
  const disabilities = checkedFrom(full.disabilities, full.disability, DISABILITIES.map((d) => d.value));
  const toggleDisability = (d: string) => {
    const next = DISABILITIES.map((o) => o.value)
      .filter((x) => (x === d ? !disabilities.includes(d) : disabilities.includes(x)));
    const summary = next.filter((x) => x !== 'others').map((x) => DISABILITIES.find((o) => o.value === x)?.label);
    if (next.includes('others')) summary.push(full.disability_other || 'Others');
    setFull({ disabilities: next, disability: summary.join(', ') });
  };
  const otherSkills = checkedFrom(full.other_skills_checked, full.other_skills_acquired, OTHER_SKILLS);
  const writeOtherSkills = (checkedList: string[], otherText: string) => {
    const checked = OTHER_SKILLS.filter((s) => checkedList.includes(s));
    const summary = [...checked, ...(has(otherText) ? [`Others: ${otherText.trim()}`] : [])];
    setFull({ other_skills_checked: checked, other_skills_other: otherText, other_skills_acquired: summary.join('\n') });
  };
  const workLocations = String(full.preferred_work_location || '').toLowerCase();
  const toggleWorkLocation = (loc: 'local' | 'overseas') => {
    const current = ['local', 'overseas'].filter((l) => workLocations.split(/[ ,]+/).includes(l));
    const next = current.includes(loc) ? current.filter((l) => l !== loc) : [...current, loc];
    setFull({ preferred_work_location: next.join(', ') });
  };
  const languages = full.languages || {};
  const toggleLanguage = (lang: string, skill: string) => {
    const row = { ...(languages[lang] || {}) };
    row[skill] = !row[skill];
    setFull({ languages: { ...languages, [lang]: row } });
  };

  const employmentTypes = EMPLOYMENT_TYPE_OPTIONS[value.employment_status] || [];
  const typeKnown = Object.values(EMPLOYMENT_TYPE_OPTIONS).flat().some((o) => o.value === full.employment_type);
  const education = full.education || {};
  const setEducation = (level: string, field: string, v: string) => (
    setFull({ education: { ...education, [level]: { ...(education[level] || {}), [field]: v } } })
  );
  const educationEdited = Object.values(education).some((r: any) => r && Object.values(r).some(has));

  return (
    <>
      <Text style={styles.formHeader}>
        NSRP Form 1 (January 2017) - Department of Labor and Employment{'\n'}PESO Employment Information System Registration Form
      </Text>
      <Text style={styles.hint}>
        Please do not leave any items unanswered. Where the paper form says to write &quot;NA&quot; (not applicable),
        leave the item blank.
      </Text>
      <Section title="I. Personal Information">
        {Text1({ k: "last_name", label: "Surname *", base: true, autoCapitalize: "words" })}
        {Text1({ k: "first_name", label: "First Name *", base: true, autoCapitalize: "words" })}
        {Text1({ k: "middle_name", label: "Middle Name", base: true, autoCapitalize: "words" })}
        {Text1({ k: "suffix", label: "Suffix (Ex: Sr., Jr., III, etc.)", placeholder: "Leave blank if none" })}
        {Text1({ k: "date_of_birth", label: "Date of Birth (YYYY-MM-DD)", base: true, placeholder: "1998-05-15" })}
        {Text1({ k: "place_of_birth", label: "Place of Birth", autoCapitalize: "words" })}
        <Choice label="Sex" options={SEX_OPTIONS} value={value.gender} onSelect={(v) => setBase('gender', v)} testID={id('gender')} />
        {Text1({ k: "religion", label: "Religion", autoCapitalize: "words" })}
        <Choice label="Civil Status" options={CIVIL_OPTIONS} value={value.civil_status} onSelect={(v) => setBase('civil_status', v)} testID={id('civil')} />

        <SubTitle text="Present Address" />
        {Text1({ k: "house_street", label: "House No. / Street" })}
        {Text1({ k: "village", label: "Village" })}
        {Text1({ k: "barangay", label: "Barangay" })}
        {Text1({ k: "city", label: "Municipality/City", base: true, autoCapitalize: "words" })}
        {Text1({ k: "province", label: "Province", base: true, autoCapitalize: "words" })}

        <View style={styles.twoCol}>
          <View style={styles.col}>{Text1({ k: "tin", label: "TIN" })}</View>
          <View style={styles.col}>{Text1({ k: "gsis_sss_no", label: "GSIS/SSS ID No." })}</View>
        </View>
        <View style={styles.twoCol}>
          <View style={styles.col}>{Text1({ k: "pagibig_no", label: "PAG-IBIG No." })}</View>
          <View style={styles.col}>{Text1({ k: "philhealth_no", label: "PhilHealth No." })}</View>
        </View>
        {Text1({ k: "height", label: "Height", placeholder: "e.g., 170 cm" })}
        {Text1({ k: "email_address", label: "Email Address", keyboardType: "email-address" })}
        <View style={styles.twoCol}>
          <View style={styles.col}>{Text1({ k: "landline_number", label: "Landline Number", keyboardType: "phone-pad" })}</View>
          <View style={styles.col}>{Text1({ k: "cell_phone_number", label: "Cellphone Number", keyboardType: "phone-pad" })}</View>
        </View>

        <ChipGroup
          label="Disability (check all that apply; leave blank if none)"
          options={DISABILITIES}
          selected={disabilities}
          onToggle={toggleDisability}
          testID={id('disability')}
        />
        {disabilities.includes('others') && Text1({ k: "disability_other", label: "Disability - Others, specify" })}

        <SubTitle text="Employment Status / Type" />
        <Choice
          label="Employment Status"
          options={EMPLOYMENT_STATUS_OPTIONS}
          value={value.employment_status}
          onSelect={(v) => onChange({ ...value, employment_status: v, nsrp_full_data: { ...full, employment_type: '' } })}
          testID={id('empstatus')}
        />
        {employmentTypes.length > 0 && (
          <Choice
            label={value.employment_status === 'employed' ? 'Type (Employed)' : 'Type (Unemployed)'}
            options={employmentTypes}
            value={full.employment_type}
            onSelect={(v) => setFull({ employment_type: v })}
            testID={id('emptype')}
          />
        )}
        {has(full.employment_type) && !typeKnown && (
          <Text style={styles.legacyNote}>Previously encoded type: {full.employment_type}. Choose the matching option above.</Text>
        )}
        {full.employment_type === 'terminated/laidoff(abroad)' && Text1({ k: "terminated_abroad_country", label: "Terminated/Laidoff (abroad) - specify country" })}
        {full.employment_type === 'others' && Text1({ k: "employment_type_other", label: "Others, specify" })}

        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Choice label="Are you actively looking for work?" options={YES_NO} value={full.looking_for_work} onSelect={(v) => setFull({ looking_for_work: v })} testID={id('looking')} />
          </View>
          <View style={styles.col}>{Text1({ k: "looking_duration", label: "How long have you been looking for work?" })}</View>
        </View>
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Choice label="Willing to work immediately?" options={YES_NO} value={full.willing_to_work_immediately} onSelect={(v) => setFull({ willing_to_work_immediately: v })} testID={id('willing')} />
          </View>
          <View style={styles.col}>{Text1({ k: "available_when", label: "If no, when?" })}</View>
        </View>
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Choice label="Are you a 4Ps beneficiary?" options={YES_NO} value={full.four_ps_beneficiary} onSelect={(v) => setFull({ four_ps_beneficiary: v })} testID={id('4ps')} />
          </View>
          <View style={styles.col}>{Text1({ k: "household_id", label: "If yes, Household ID No." })}</View>
        </View>
      </Section>

      <Section title="II. Job Preference">
        <SubTitle text="Preferred Occupation" />
        {list('preferred_occupation_list', 4).map((v, i) => (
          <Input key={`occ-${i}`} testID={id(`occupation-${i + 1}`)} label={`${i + 1}.`} value={v} onChangeText={(t) => setListItem('preferred_occupation_list', 4, i, t)} autoCapitalize="words" />
        ))}
        {legacyBox(!anyRowList(full.preferred_occupation_list), 'preferred_occupations')}

        <ChipGroup
          label="Preferred Work Location"
          options={[{ value: 'local', label: 'Local' }, { value: 'overseas', label: 'Overseas' }]}
          selected={['local', 'overseas'].filter((l) => workLocations.split(/[ ,]+/).includes(l))}
          onToggle={(l) => toggleWorkLocation(l as 'local' | 'overseas')}
          testID={id('work-location')}
        />
        {has(full.preferred_work_location) && !/^(local|overseas|local, overseas|overseas, local)$/i.test(String(full.preferred_work_location).trim()) && (
          <Text style={styles.legacyNote}>Previously encoded: {full.preferred_work_location}. Choose Local and/or Overseas above.</Text>
        )}
        <SubTitle text="Local - specify cities/municipalities" />
        {list('local_location_list', 3).map((v, i) => (
          <Input key={`loc-${i}`} testID={id(`local-${i + 1}`)} label={`${i + 1}.`} value={v} onChangeText={(t) => setListItem('local_location_list', 3, i, t)} autoCapitalize="words" />
        ))}
        {legacyBox(!anyRowList(full.local_location_list), 'preferred_local_locations')}
        <SubTitle text="Overseas - specify countries" />
        {list('overseas_location_list', 3).map((v, i) => (
          <Input key={`ovs-${i}`} testID={id(`overseas-${i + 1}`)} label={`${i + 1}.`} value={v} onChangeText={(t) => setListItem('overseas_location_list', 3, i, t)} autoCapitalize="words" />
        ))}
        {legacyBox(!anyRowList(full.overseas_location_list), 'preferred_overseas_locations')}
        {Text1({ k: "expected_salary", label: "Expected Salary (Range)", placeholder: "e.g., PHP 15,000 - 20,000" })}
        <View style={styles.twoCol}>
          <View style={styles.col}>{Text1({ k: "passport_number", label: "Passport No." })}</View>
          <View style={styles.col}>{Text1({ k: "passport_expiry", label: "Expiry Date" })}</View>
        </View>
      </Section>

      <Section title="III. Language / Dialect Proficiency">
        <Text style={styles.hint}>Check if applicable.</Text>
        {LANGUAGES.map((lang) => (
          <View key={lang.key} style={styles.langRow}>
            {lang.key === 'other' ? (
              <Input
                testID={id('language-other-name')}
                label="Others (specify)"
                value={String(languages.other?.name || '')}
                onChangeText={(t) => setFull({ languages: { ...languages, other: { ...(languages.other || {}), name: t } } })}
              />
            ) : (
              <Text style={styles.langName}>{lang.label}</Text>
            )}
            <View style={styles.chipRow}>
              {LANGUAGE_SKILLS.map((sk) => (
                <SmallToggle
                  key={sk.key}
                  testID={id(`lang-${lang.key}-${sk.key}`)}
                  label={sk.label}
                  active={!!languages[lang.key]?.[sk.key]}
                  onPress={() => toggleLanguage(lang.key, sk.key)}
                />
              ))}
            </View>
          </View>
        ))}
        {legacyBox(!full.languages, 'language_proficiency')}
      </Section>

      <Section title="IV. Educational Background">
        {EDUCATION_LEVELS.map((level) => {
          const row = education[level.key] || {};
          return (
            <View key={level.key} style={styles.rowCard}>
              <Text style={styles.rowTitle}>{level.label}</Text>
              <Input testID={id(`edu-${level.key}-school`)} label="School" value={row.school || ''} onChangeText={(t) => setEducation(level.key, 'school', t)} autoCapitalize="words" />
              <Input testID={id(`edu-${level.key}-course`)} label="Course" value={row.course || ''} onChangeText={(t) => setEducation(level.key, 'course', t)} />
              <Input testID={id(`edu-${level.key}-year`)} label="Year Graduated" value={row.year_graduated || ''} onChangeText={(t) => setEducation(level.key, 'year_graduated', t)} keyboardType="number-pad" />
              <Text style={styles.hint}>If undergraduate:</Text>
              <View style={styles.twoCol}>
                <View style={styles.col}><Input testID={id(`edu-${level.key}-level`)} label="What level?" value={row.level_reached || ''} onChangeText={(t) => setEducation(level.key, 'level_reached', t)} /></View>
                <View style={styles.col}><Input testID={id(`edu-${level.key}-last`)} label="Year last attended" value={row.year_last_attended || ''} onChangeText={(t) => setEducation(level.key, 'year_last_attended', t)} keyboardType="number-pad" /></View>
              </View>
              <Input testID={id(`edu-${level.key}-awards`)} label="Awards Received" value={row.awards || ''} onChangeText={(t) => setEducation(level.key, 'awards', t)} />
            </View>
          );
        })}
        {!educationEdited && ['elementary_background', 'secondary_background', 'tertiary_background', 'graduate_studies_background']
          .map((k) => legacyBox(true, k, `Previously encoded - ${k.replace('_background', '').replace('_', ' ')}`))}
      </Section>

      <Section title="V. Technical/Vocational and Other Training">
        <Text style={styles.hint}>Include courses taken as part of college education.</Text>
        {rows('training_rows', 3).map((r: any, i: number) => (
          <View key={`tr-${i}`} style={styles.rowCard}>
            <Text style={styles.rowTitle}>{i + 1}.</Text>
            <Input testID={id(`training-${i + 1}-course`)} label="Training/Vocational Course" value={r.course || ''} onChangeText={(t) => setRow('training_rows', 3, i, 'course', t)} />
            <Input testID={id(`training-${i + 1}-duration`)} label="Duration (mm/dd/yyyy to mm/dd/yyyy)" value={r.duration || ''} onChangeText={(t) => setRow('training_rows', 3, i, 'duration', t)} />
            <Input testID={id(`training-${i + 1}-institution`)} label="Training Institution" value={r.institution || ''} onChangeText={(t) => setRow('training_rows', 3, i, 'institution', t)} />
            <Input testID={id(`training-${i + 1}-cert`)} label="Certificates Received (NC I, NC II, NC III, NC IV, etc.)" value={r.certificate || ''} onChangeText={(t) => setRow('training_rows', 3, i, 'certificate', t)} />
          </View>
        ))}
        {legacyBox(!anyRow(full.training_rows), 'trainings')}
      </Section>

      <Section title="VI. Eligibility / Professional License">
        <SubTitle text="Eligibility (Civil Service)" />
        {rows('eligibility_rows', 2).map((r: any, i: number) => (
          <View key={`el-${i}`} style={styles.rowCard}>
            <Input testID={id(`eligibility-${i + 1}`)} label={`${i + 1}. Eligibility`} value={r.eligibility || ''} onChangeText={(t) => setRow('eligibility_rows', 2, i, 'eligibility', t)} />
            <View style={styles.twoCol}>
              <View style={styles.col}><Input testID={id(`eligibility-${i + 1}-rating`)} label="Rating" value={r.rating || ''} onChangeText={(t) => setRow('eligibility_rows', 2, i, 'rating', t)} /></View>
              <View style={styles.col}><Input testID={id(`eligibility-${i + 1}-date`)} label="Date of Examination" value={r.exam_date || ''} onChangeText={(t) => setRow('eligibility_rows', 2, i, 'exam_date', t)} /></View>
            </View>
          </View>
        ))}
        <SubTitle text="Professional License (PRC)" />
        {rows('license_rows', 2).map((r: any, i: number) => (
          <View key={`lic-${i}`} style={styles.twoCol}>
            <View style={styles.col}><Input testID={id(`license-${i + 1}`)} label={`${i + 1}. License`} value={r.license || ''} onChangeText={(t) => setRow('license_rows', 2, i, 'license', t)} /></View>
            <View style={styles.col}><Input testID={id(`license-${i + 1}-valid`)} label="Valid Until" value={r.valid_until || ''} onChangeText={(t) => setRow('license_rows', 2, i, 'valid_until', t)} /></View>
          </View>
        ))}
        {legacyBox(!anyRow(full.eligibility_rows) && !anyRow(full.license_rows), 'eligibility_license')}
      </Section>

      <Section title="VII. Work Experience">
        <Text style={styles.hint}>Limit to a 10-year period, starting with the most recent employment.</Text>
        {rows('work_rows', Math.min(5, Math.max(2, (full.work_rows || []).filter((r: any) => r && Object.values(r).some(has)).length + 1))).map((r: any, i: number, all: any[]) => (
          <View key={`wk-${i}`} style={styles.rowCard}>
            <Text style={styles.rowTitle}>{i + 1}.</Text>
            <Input testID={id(`work-${i + 1}-company`)} label="Company Name" value={r.company || ''} onChangeText={(t) => setRow('work_rows', all.length, i, 'company', t)} />
            <Input testID={id(`work-${i + 1}-address`)} label="Address (City/Municipality)" value={r.address || ''} onChangeText={(t) => setRow('work_rows', all.length, i, 'address', t)} />
            <Input testID={id(`work-${i + 1}-position`)} label="Position" value={r.position || ''} onChangeText={(t) => setRow('work_rows', all.length, i, 'position', t)} />
            <View style={styles.twoCol}>
              <View style={styles.col}><Input testID={id(`work-${i + 1}-dates`)} label="Inclusive Dates (mm/yyyy to mm/yyyy)" value={r.dates || ''} onChangeText={(t) => setRow('work_rows', all.length, i, 'dates', t)} /></View>
              <View style={styles.col}><Input testID={id(`work-${i + 1}-status`)} label="Status (Permanent, Contractual, Part-time, Probationary)" value={r.status || ''} onChangeText={(t) => setRow('work_rows', all.length, i, 'status', t)} /></View>
            </View>
          </View>
        ))}
        {legacyBox(!anyRow(full.work_rows), 'work_experience')}
      </Section>

      <Section title="VIII. Other Skills Acquired Without Formal Training">
        <ChipGroup
          label="Check all that apply"
          options={OTHER_SKILLS.map((s) => ({ value: s, label: s }))}
          selected={otherSkills}
          onToggle={(skill) => writeOtherSkills(
            otherSkills.includes(skill) ? otherSkills.filter((s) => s !== skill) : [...otherSkills, skill],
            full.other_skills_other || '',
          )}
          testID={id('other-skill')}
        />
        <Input
          testID={id('other-skills-other')}
          label="Others"
          value={String(full.other_skills_other || '')}
          onChangeText={(t) => writeOtherSkills(otherSkills, t)}
        />
        {legacyBox(!Array.isArray(full.other_skills_checked), 'other_skills_acquired')}
      </Section>
    </>
  );
}

const anyRowList = (arr: any) => Array.isArray(arr) && arr.some(has);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </Card>
  );
}

function SubTitle({ text }: { text: string }) {
  return <Text style={styles.subTitle}>{text}</Text>;
}

function Choice({
  label, options, value, onSelect, testID,
}: { label: string; options: { value: string; label: string }[]; value?: string; onSelect: (v: string) => void; testID?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((o) => (
          <SmallToggle key={o.value} testID={`${testID}-${o.value}`} label={o.label} active={value === o.value} onPress={() => onSelect(o.value)} />
        ))}
      </View>
    </View>
  );
}

function ChipGroup({
  label, options, selected, onToggle, testID,
}: { label: string; options: { value: string; label: string }[]; selected: string[]; onToggle: (v: string) => void; testID?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((o) => (
          <SmallToggle key={o.value} testID={`${testID}-${o.value}`} label={o.label} active={selected.includes(o.value)} onPress={() => onToggle(o.value)} />
        ))}
      </View>
    </View>
  );
}

function SmallToggle({ label, active, onPress, testID }: { label: string; active: boolean; onPress: () => void; testID?: string }) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      style={[styles.toggle, active && styles.toggleActive]}
    >
      <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{active ? `✓ ${label}` : label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  sectionCard: { marginTop: Spacing.sm },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '900', color: Colors.textDark, marginBottom: Spacing.sm },
  subTitle: { fontSize: FontSize.sm, fontWeight: '900', color: Colors.primary, marginTop: Spacing.xs, marginBottom: Spacing.xs },
  formHeader: { fontSize: FontSize.xs, fontWeight: '800', color: Colors.textDark, marginBottom: Spacing.xs },
  hint: { fontSize: FontSize.xs, color: Colors.gray, marginBottom: Spacing.xs },
  legacyNote: { fontSize: FontSize.xs, color: '#92400E', fontWeight: '700', marginBottom: Spacing.sm },
  field: { marginBottom: Spacing.md },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark, marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  toggle: {
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white,
    borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 7,
  },
  toggleActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  toggleText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark },
  toggleTextActive: { color: Colors.white },
  twoCol: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  col: { flex: 1, minWidth: 140 },
  rowCard: {
    borderWidth: 1, borderColor: Colors.borderSoft, borderRadius: Radius.md,
    padding: Spacing.sm, marginBottom: Spacing.sm, backgroundColor: Colors.surface,
  },
  rowTitle: { fontSize: FontSize.sm, fontWeight: '900', color: Colors.primaryDark, marginBottom: 4 },
  langRow: { marginBottom: Spacing.sm },
  langName: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.textDark, marginBottom: 6 },
});
