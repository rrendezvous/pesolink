// ============================================================
// Upload NSRP Form + OCR-assisted NSRP review (combined)
// OCR is OPTIONAL & ASSISTIVE - User must review/confirm before saving.
// ============================================================
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, Alert, KeyboardAvoidingView, Platform, TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Button, Input, Card } from '../../src/components/ui';
import { api, getApiError } from '../../src/api/client';
import { Colors, Spacing, FontSize, Radius } from '../../src/constants/theme';

const OCR_UPLOAD_TIMEOUT_MS = 90000;
const OCR_EXTRACT_TIMEOUT_MS = 210000;

const defaultNsrpFullData = {
  suffix: '', place_of_birth: '', religion: '', height: '', weight: '',
  tin: '', gsis_sss_no: '', pagibig_no: '', philhealth_no: '',
  email_address: '', landline_number: '', cell_phone_number: '',
  house_street: '', village: '', barangay: '',
  disability: '', disability_other: '', employment_type: '',
  looking_for_work: '', looking_duration: '', willing_to_work_immediately: '',
  available_when: '', four_ps_beneficiary: '', household_id: '',
  language_dialect: '', language_proficiency: '', other_skills: '',
  other_skills_acquired: '', trainings: '', eligibility_license: '',
  work_experience: '', elementary_background: '', secondary_background: '',
  tertiary_background: '', graduate_studies_background: '',
  preferred_occupations: '', preferred_work_location: '',
  preferred_local_locations: '', preferred_overseas_locations: '',
  expected_salary: '', availability: '', passport_number: '', passport_expiry: '',
};

const emptyExtracted = {
  first_name: '', middle_name: '', last_name: '',
  date_of_birth: '', gender: '', civil_status: '',
  contact_number: '', address: '', city: '', province: '',
  education_level: '', course: '', years_of_experience: 0,
  employment_status: '', preferred_occupation: '',
  nsrp_full_data: defaultNsrpFullData,
};

const hasMergeValue = (value: any) => {
  if (typeof value === 'number') return value !== 0;
  return String(value ?? '').trim().length > 0;
};

const mergeExtractedData = (previous: any, incoming: any) => {
  if (!previous) {
    return {
      ...emptyExtracted,
      ...(incoming || {}),
      nsrp_full_data: {
        ...defaultNsrpFullData,
        ...(incoming?.nsrp_full_data || {}),
      },
    };
  }
  if (!incoming) return previous;

  const merged: any = {
    ...previous,
    nsrp_full_data: {
      ...defaultNsrpFullData,
      ...(previous.nsrp_full_data || {}),
    },
  };

  Object.keys(incoming).forEach((key) => {
    if (key === 'nsrp_full_data') return;
    if (hasMergeValue(incoming[key])) merged[key] = incoming[key];
  });

  Object.entries(incoming.nsrp_full_data || {}).forEach(([key, value]) => {
    if (hasMergeValue(value)) merged.nsrp_full_data[key] = value;
  });

  return merged;
};

export default function UploadNSRP() {
  const router = useRouter();
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploadId, setUploadId] = useState<number | null>(null);
  const [extracted, setExtracted] = useState<any | null>(null);
  const [ocrSuccess, setOcrSuccess] = useState<boolean | null>(null);
  const [ocrStatus, setOcrStatus] = useState('');
  const [fieldCount, setFieldCount] = useState(0);
  const [ocrMessage, setOcrMessage] = useState('');
  const [pageType, setPageType] = useState('');
  const [rawText, setRawText] = useState('');
  const [ocrRegions, setOcrRegions] = useState<any | null>(null);
  const [showRawText, setShowRawText] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const resetReview = () => {
    setUploadId(null);
    setExtracted(null);
    setOcrSuccess(null);
    setOcrStatus('');
    setFieldCount(0);
    setOcrMessage('');
    setPageType('');
    setRawText('');
    setOcrRegions(null);
    setShowRawText(false);
  };

  const clearAll = () => {
    setImageBase64(null);
    setImageUri(null);
    resetReview();
  };

  const imageMimeType = (asset: ImagePicker.ImagePickerAsset) => {
    if (asset.mimeType?.startsWith('image/')) return asset.mimeType;
    const uri = asset.uri.toLowerCase();
    if (uri.endsWith('.png')) return 'image/png';
    if (uri.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
  };

  const setPickedAsset = (asset: ImagePicker.ImagePickerAsset) => {
    if (!asset.base64) {
      Alert.alert('Image error', 'The selected image did not include readable image data. Please try again.');
      return;
    }
    setImageBase64(`data:${imageMimeType(asset)};base64,${asset.base64}`);
    setImageUri(asset.uri);
    if (!extracted) setUploadId(null);
    setOcrSuccess(null);
    setOcrStatus('');
    setFieldCount(0);
    setOcrMessage(extracted ? 'Selected image is ready to scan and merge into the current editable review.' : '');
    setPageType('');
    setRawText('');
    setOcrRegions(null);
    setShowRawText(false);
  };

  const getOcrRequestMessage = (err: any, stage: 'upload' | 'extract') => {
    if (err?.code === 'ECONNABORTED' || String(err?.message || '').toLowerCase().includes('timeout')) {
      return stage === 'extract'
        ? 'OCR timed out before the backend finished reading the form. Try a clearer compressed image, or encode the NSRP-based profile manually below.'
        : 'The NSRP image upload timed out. Try a smaller clear JPEG or PNG, then scan again.';
    }
    if (err?.response) return getApiError(err);
    if (err?.request) {
      return 'Backend could not be reached. Check that the API server is running and that EXPO_PUBLIC_BACKEND_URL points to your computer IP when using an Android device/emulator.';
    }
    return getApiError(err);
  };

  const getRequestFailureStatus = (err: any) => {
    if (err?.code === 'ECONNABORTED' || String(err?.message || '').toLowerCase().includes('timeout')) {
      return 'timeout';
    }
    if (err?.request && !err?.response) return 'backend_unreachable';
    return 'backend_error';
  };

  const getOcrStatusTitle = () => {
    if (ocrStatus === 'backend_unreachable') return 'Backend could not be reached';
    if (ocrStatus === 'timeout') return 'OCR timed out';
    if (ocrStatus === 'backend_error') return 'OCR backend error';
    if (ocrStatus === 'no_text') return 'OCR ran but found no text';
    if (ocrStatus === 'no_fields') return 'OCR ran but found no reliable NSRP fields';
    return 'OCR did not extract usable text';
  };

  const getOcrStatusMessage = () => {
    if (ocrStatus === 'fields_extracted') {
      const pageLabel = pageType === 'page2' ? 'page 2' : pageType === 'page1' ? 'page 1' : 'the NSRP form';
      return fieldCount > 0
        ? `OCR extracted ${fieldCount} editable field${fieldCount === 1 ? '' : 's'} from ${pageLabel}. Please review every field before saving.`
        : 'OCR extracted editable fields. Please review every field before saving.';
    }
    return ocrMessage || 'Please encode each NSRP field manually below.';
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission required', 'Please allow gallery access to pick the NSRP form image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 1,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPickedAsset(result.assets[0]);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission required', 'Please allow camera access to capture the NSRP form.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 1,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPickedAsset(result.assets[0]);
    }
  };

  const uploadAndExtract = async () => {
    if (!imageBase64) {
      Alert.alert('No image', 'Please pick or capture an NSRP form first.');
      return;
    }
    setUploading(true);
    setOcrSuccess(null);
    setOcrStatus('');
    setFieldCount(0);
    setOcrMessage('');
    setPageType('');
    setRawText('');
    setOcrRegions(null);
    setShowRawText(false);
    let stage: 'upload' | 'extract' = 'upload';
    try {
      const upRes = await api.post(
        '/nsrp/upload',
        { image_base64: imageBase64 },
        { timeout: OCR_UPLOAD_TIMEOUT_MS }
      );
      const newUploadId = upRes.data.upload_id;
      setUploadId(newUploadId);
      setUploading(false);
      setExtracting(true);
      stage = 'extract';
      const exRes = await api.post('/nsrp/extract', { upload_id: newUploadId }, { timeout: OCR_EXTRACT_TIMEOUT_MS });
      const nextStatus = exRes.data.ocr_status || (exRes.data.success ? 'fields_extracted' : 'no_text');
      const nextFieldCount = Number(exRes.data.field_count || 0);
      const nextPageType = exRes.data.page_type || '';
      setExtracted((current: any) => mergeExtractedData(current, exRes.data.extracted_data));
      setRawText(exRes.data.raw_text || '');
      setOcrRegions(exRes.data.ocr_regions || null);
      setOcrSuccess(!!exRes.data.success);
      setOcrStatus(nextStatus);
      setFieldCount(nextFieldCount);
      setPageType(nextPageType);
      setOcrMessage(exRes.data.notice || exRes.data.error_message || '');
      
      if (nextStatus === 'fields_extracted') {
        const title = nextPageType === 'page2' ? 'Page 2 OCR Complete' : 'OCR Complete';
        Alert.alert(title, 'Text was extracted into editable fields. Please scroll down to review and edit before saving.');
      }

    } catch (err) {
      setExtracted((current: any) => current || emptyExtracted);
      setOcrRegions(null);
      setOcrSuccess(false);
      setOcrStatus(getRequestFailureStatus(err));
      setFieldCount(0);
      setPageType('');
      setOcrMessage(getOcrRequestMessage(err, stage));
    } finally {
      setUploading(false);
      setExtracting(false);
    }
  };

  const setField = (k: string, v: any) => setExtracted((p: any) => ({ ...p, [k]: v }));
  const setFullDataField = (k: keyof typeof defaultNsrpFullData, v: string) => (
    setExtracted((p: any) => ({
      ...p,
      nsrp_full_data: { ...defaultNsrpFullData, ...(p?.nsrp_full_data || {}), [k]: v },
    }))
  );
  const fullDataValue = (k: keyof typeof defaultNsrpFullData) => (
    extracted?.nsrp_full_data?.[k] || ''
  );

  const confirmAndSave = async () => {
    if (!extracted) return;
    setConfirming(true);
    try {
      await api.post('/nsrp/confirm', { upload_id: uploadId, confirmed_data: extracted });
      Alert.alert(
        'Saved',
        'Your reviewed NSRP data has been saved to your profile.',
        [{ text: 'OK', onPress: () => router.replace('/(seeker)/profile') }]
      );
    } catch (err) {
      Alert.alert('Error', getApiError(err));
    } finally {
      setConfirming(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.kicker}>OCR ASSISTANT</Text>
          <Text style={styles.headerTitle}>Scan NSRP Form</Text>
          <Text style={styles.headerSub}>Auto-fill is optional. Human review is mandatory before saving.</Text>
        </View>

        <View style={styles.body}>
          <Card style={styles.captureCard}>
            <Text style={styles.section}>Step 1: Capture or select form</Text>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.cameraIcon}>[]</Text>
                <Text style={styles.placeholderTitle}>Place NSRP form within frame</Text>
                <Text style={styles.placeholderSub}>Select an image or use the camera to begin.</Text>
              </View>
            )}
            <View style={styles.pickRow}>
              <View style={{ flex: 1 }}>
                <Button testID="pick-image" title="Gallery" variant="secondary" onPress={pickImage} />
              </View>
              <View style={{ width: Spacing.sm }} />
              <View style={{ flex: 1 }}>
                <Button testID="take-photo" title="Camera" variant="secondary" onPress={takePhoto} />
              </View>
            </View>
            <View style={{ marginTop: Spacing.sm }}>
              <Button
                testID="upload-extract"
                title={uploading ? 'Uploading...' : extracting ? 'Extracting OCR...' : 'Scan and Pre-fill'}
                onPress={uploadAndExtract}
                loading={uploading || extracting}
                disabled={!imageBase64}
              />
            </View>
            {(imageBase64 || extracted) && (
              <View style={{ marginTop: Spacing.sm }}>
                <Button
                  testID="clear-review"
                  title="Start Over"
                  variant="secondary"
                  onPress={clearAll}
                  disabled={uploading || extracting || confirming}
                />
              </View>
            )}
          </Card>

          <Card style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>OCR Notice</Text>
            <Text style={styles.notice}>
              OCR extracts raw text and places possible values into editable fields. It does not auto-save,
              validate identity, rank, screen, or make decisions. If OCR fails, manually encode the form below.
            </Text>
          </Card>

          {extracted && (
            <Card style={styles.reviewCard}>
              <Text style={styles.section}>Step 2: Review and confirm</Text>
              {ocrSuccess === false ? (
                <View style={styles.warningBox}>
                  <Text style={styles.warningTitle}>{getOcrStatusTitle()}</Text>
                  <Text style={styles.warningText}>
                    {getOcrStatusMessage()}
                  </Text>
                </View>
              ) : (
                <Text style={styles.noticeInline}>
                  {getOcrStatusMessage()}
                </Text>
              )}

              {!!rawText && (
                <TouchableOpacity onPress={() => setShowRawText((v) => !v)} testID="toggle-raw-text" style={styles.rawToggle}>
                  <Text style={styles.rawToggleText}>
                    {showRawText ? 'Hide raw extracted text' : 'View raw extracted text'}
                  </Text>
                </TouchableOpacity>
              )}
              {showRawText && !!rawText && (
                <View style={styles.rawBox}>
                  <Text style={styles.rawText}>{rawText}</Text>
                  {!!ocrRegions && (
                    <Text style={styles.rawText}>
                      {`\n\n--- OCR cell regions ---\n${JSON.stringify(ocrRegions, null, 2)}`}
                    </Text>
                  )}
                </View>
              )}

              <Text style={styles.formGroup}>I. Personal Information</Text>
              <Input testID="rev-first" label="First Name" value={extracted.first_name || ''} onChangeText={(v) => setField('first_name', v)} autoCapitalize="words" />
              <Input testID="rev-middle" label="Middle Name" value={extracted.middle_name || ''} onChangeText={(v) => setField('middle_name', v)} autoCapitalize="words" />
              <Input testID="rev-last" label="Last Name" value={extracted.last_name || ''} onChangeText={(v) => setField('last_name', v)} autoCapitalize="words" />
              <Input testID="rev-suffix" label="Suffix" value={fullDataValue('suffix')} onChangeText={(v) => setFullDataField('suffix', v)} />
              <Input testID="rev-dob" label="Date of Birth (YYYY-MM-DD)" value={extracted.date_of_birth || ''} onChangeText={(v) => setField('date_of_birth', v)} />
              <Input testID="rev-place-birth" label="Place of Birth" value={fullDataValue('place_of_birth')} onChangeText={(v) => setFullDataField('place_of_birth', v)} autoCapitalize="words" />
              <Input testID="rev-gender" label="Gender" value={extracted.gender || ''} onChangeText={(v) => setField('gender', v)} />
              <Input testID="rev-civil" label="Civil Status" value={extracted.civil_status || ''} onChangeText={(v) => setField('civil_status', v)} />
              <Input testID="rev-religion" label="Religion" value={fullDataValue('religion')} onChangeText={(v) => setFullDataField('religion', v)} />
              <Input testID="rev-height" label="Height" value={fullDataValue('height')} onChangeText={(v) => setFullDataField('height', v)} />
              <Input testID="rev-tin" label="TIN" value={fullDataValue('tin')} onChangeText={(v) => setFullDataField('tin', v)} />
              <Input testID="rev-gsis-sss" label="GSIS/SSS ID No." value={fullDataValue('gsis_sss_no')} onChangeText={(v) => setFullDataField('gsis_sss_no', v)} />
              <Input testID="rev-pagibig" label="PAG-IBIG No." value={fullDataValue('pagibig_no')} onChangeText={(v) => setFullDataField('pagibig_no', v)} />
              <Input testID="rev-philhealth" label="PhilHealth No." value={fullDataValue('philhealth_no')} onChangeText={(v) => setFullDataField('philhealth_no', v)} />
              <Input testID="rev-email" label="Email Address" value={fullDataValue('email_address')} onChangeText={(v) => setFullDataField('email_address', v)} keyboardType="email-address" />
              <Input testID="rev-landline" label="Landline Number" value={fullDataValue('landline_number')} onChangeText={(v) => setFullDataField('landline_number', v)} />
              <Input testID="rev-contact" label="Contact Number" value={extracted.contact_number || ''} onChangeText={(v) => setField('contact_number', v)} keyboardType="phone-pad" />
              <Input testID="rev-cellphone" label="Cellphone Number" value={fullDataValue('cell_phone_number')} onChangeText={(v) => setFullDataField('cell_phone_number', v)} keyboardType="phone-pad" />
              <Input testID="rev-address" label="Present Address" value={extracted.address || ''} onChangeText={(v) => setField('address', v)} multiline numberOfLines={2} />
              <Input testID="rev-house-street" label="House No. / Street" value={fullDataValue('house_street')} onChangeText={(v) => setFullDataField('house_street', v)} />
              <Input testID="rev-village" label="Village" value={fullDataValue('village')} onChangeText={(v) => setFullDataField('village', v)} />
              <Input testID="rev-barangay" label="Barangay" value={fullDataValue('barangay')} onChangeText={(v) => setFullDataField('barangay', v)} />
              <Input testID="rev-city" label="Municipality/City" value={extracted.city || ''} onChangeText={(v) => setField('city', v)} autoCapitalize="words" />
              <Input testID="rev-province" label="Province" value={extracted.province || ''} onChangeText={(v) => setField('province', v)} autoCapitalize="words" />
              <Input testID="rev-disability" label="Disability" value={fullDataValue('disability')} onChangeText={(v) => setFullDataField('disability', v)} />
              <Input testID="rev-disability-other" label="Disability - Others, Specify" value={fullDataValue('disability_other')} onChangeText={(v) => setFullDataField('disability_other', v)} />
              <Input testID="rev-emp-status" label="Employment Status" value={extracted.employment_status || ''} onChangeText={(v) => setField('employment_status', v)} />
              <Input testID="rev-emp-type" label="Employment Type" value={fullDataValue('employment_type')} onChangeText={(v) => setFullDataField('employment_type', v)} />
              <Input testID="rev-looking-work" label="Actively Looking for Work?" value={fullDataValue('looking_for_work')} onChangeText={(v) => setFullDataField('looking_for_work', v)} />
              <Input testID="rev-looking-duration" label="How Long Looking for Work?" value={fullDataValue('looking_duration')} onChangeText={(v) => setFullDataField('looking_duration', v)} />
              <Input testID="rev-willing-now" label="Willing to Work Immediately?" value={fullDataValue('willing_to_work_immediately')} onChangeText={(v) => setFullDataField('willing_to_work_immediately', v)} />
              <Input testID="rev-available-when" label="If No, When?" value={fullDataValue('available_when')} onChangeText={(v) => setFullDataField('available_when', v)} />
              <Input testID="rev-4ps" label="4Ps Beneficiary?" value={fullDataValue('four_ps_beneficiary')} onChangeText={(v) => setFullDataField('four_ps_beneficiary', v)} />
              <Input testID="rev-household-id" label="Household ID No." value={fullDataValue('household_id')} onChangeText={(v) => setFullDataField('household_id', v)} />

              <Text style={styles.formGroup}>II. Job Preference</Text>
              <Input testID="rev-edu" label="Education Level" value={extracted.education_level || ''} onChangeText={(v) => setField('education_level', v)} />
              <Input testID="rev-course" label="Course" value={extracted.course || ''} onChangeText={(v) => setField('course', v)} />
              <Input testID="rev-occ" label="Preferred Occupation" value={extracted.preferred_occupation || ''} onChangeText={(v) => setField('preferred_occupation', v)} autoCapitalize="words" />
              <Input testID="rev-pref-occupations" label="Preferred Occupations (1-4)" value={fullDataValue('preferred_occupations')} onChangeText={(v) => setFullDataField('preferred_occupations', v)} multiline numberOfLines={3} />
              <Input testID="rev-work-location" label="Preferred Work Location" value={fullDataValue('preferred_work_location')} onChangeText={(v) => setFullDataField('preferred_work_location', v)} />
              <Input testID="rev-local-locations" label="Local Cities/Municipalities" value={fullDataValue('preferred_local_locations')} onChangeText={(v) => setFullDataField('preferred_local_locations', v)} multiline numberOfLines={2} />
              <Input testID="rev-overseas-locations" label="Overseas Countries" value={fullDataValue('preferred_overseas_locations')} onChangeText={(v) => setFullDataField('preferred_overseas_locations', v)} multiline numberOfLines={2} />
              <Input testID="rev-expected-salary" label="Expected Salary Range" value={fullDataValue('expected_salary')} onChangeText={(v) => setFullDataField('expected_salary', v)} />
              <Input testID="rev-passport" label="Passport No." value={fullDataValue('passport_number')} onChangeText={(v) => setFullDataField('passport_number', v)} />
              <Input testID="rev-passport-expiry" label="Passport Expiry Date" value={fullDataValue('passport_expiry')} onChangeText={(v) => setFullDataField('passport_expiry', v)} />

              <Text style={styles.formGroup}>III. Language / Dialect Proficiency</Text>
              <Input testID="rev-language" label="Language / Dialect" value={fullDataValue('language_dialect')} onChangeText={(v) => setFullDataField('language_dialect', v)} />
              <Input testID="rev-language-prof" label="Read / Write / Speak / Understand" value={fullDataValue('language_proficiency')} onChangeText={(v) => setFullDataField('language_proficiency', v)} multiline numberOfLines={3} />

              <Text style={styles.formGroup}>IV. Educational Background</Text>
              <Input testID="rev-elem-bg" label="Elementary" value={fullDataValue('elementary_background')} onChangeText={(v) => setFullDataField('elementary_background', v)} multiline numberOfLines={2} />
              <Input testID="rev-secondary-bg" label="Secondary" value={fullDataValue('secondary_background')} onChangeText={(v) => setFullDataField('secondary_background', v)} multiline numberOfLines={2} />
              <Input testID="rev-tertiary-bg" label="Tertiary" value={fullDataValue('tertiary_background')} onChangeText={(v) => setFullDataField('tertiary_background', v)} multiline numberOfLines={2} />
              <Input testID="rev-grad-bg" label="Graduate Studies" value={fullDataValue('graduate_studies_background')} onChangeText={(v) => setFullDataField('graduate_studies_background', v)} multiline numberOfLines={2} />

              <Text style={styles.formGroup}>V-VIII. Training, License, Experience, Other Skills</Text>
              <Input testID="rev-trainings" label="Technical/Vocational and Other Training" value={fullDataValue('trainings')} onChangeText={(v) => setFullDataField('trainings', v)} multiline numberOfLines={3} />
              <Input testID="rev-eligibility" label="Eligibility / Professional License" value={fullDataValue('eligibility_license')} onChangeText={(v) => setFullDataField('eligibility_license', v)} multiline numberOfLines={2} />
              <Input testID="rev-workexp" label="Work Experience" value={fullDataValue('work_experience')} onChangeText={(v) => setFullDataField('work_experience', v)} multiline numberOfLines={4} />
              <Input testID="rev-other-skills" label="Other Skills Acquired Without Formal Training" value={fullDataValue('other_skills_acquired')} onChangeText={(v) => setFullDataField('other_skills_acquired', v)} multiline numberOfLines={3} />

              <View style={{ marginTop: Spacing.sm }}>
                <Button testID="confirm-save" title="Confirm and Save" onPress={confirmAndSave} loading={confirming} />
              </View>
            </Card>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.lightBg },
  content: { paddingBottom: Spacing.xl },
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
  captureCard: { marginBottom: Spacing.md },
  noticeCard: { backgroundColor: Colors.cardHighlight },
  reviewCard: { marginTop: Spacing.sm },
  noticeTitle: { fontSize: FontSize.md, fontWeight: '900', color: Colors.textDark, marginBottom: 6 },
  notice: { fontSize: FontSize.xs, color: Colors.textDark, lineHeight: 18 },
  noticeInline: { fontSize: FontSize.xs, color: Colors.primary, marginBottom: Spacing.sm, fontWeight: '700', lineHeight: 18 },
  section: { fontSize: FontSize.md, fontWeight: '900', color: Colors.textDark, marginBottom: Spacing.sm },
  preview: { width: '100%', height: 250, borderRadius: Radius.lg, backgroundColor: Colors.white, borderColor: Colors.borderSoft, borderWidth: 1 },
  placeholder: {
    height: 280,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.primarySoft,
    borderRadius: Radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
  },
  cameraIcon: { color: Colors.textDark, fontSize: FontSize.xxxl, fontWeight: '900', marginBottom: Spacing.sm },
  placeholderTitle: { color: Colors.textDark, textAlign: 'center', fontSize: FontSize.md, fontWeight: '900', textTransform: 'uppercase' },
  placeholderSub: { color: Colors.gray, textAlign: 'center', fontSize: FontSize.xs, marginTop: 8, lineHeight: 18 },
  pickRow: { flexDirection: 'row', marginTop: Spacing.md },
  warningBox: {
    backgroundColor: '#FEF3C7',
    borderColor: Colors.warning,
    borderWidth: 1,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  warningTitle: { fontWeight: '900', color: '#92400E', fontSize: FontSize.sm },
  warningText: { color: '#92400E', fontSize: FontSize.xs, marginTop: 4, lineHeight: 16 },
  rawToggle: { marginBottom: Spacing.sm },
  rawToggleText: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: '900' },
  rawBox: { backgroundColor: Colors.surface, padding: 10, borderRadius: Radius.md, marginBottom: Spacing.sm },
  rawText: { fontSize: FontSize.xs, color: Colors.gray, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  formGroup: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: '900',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
});
