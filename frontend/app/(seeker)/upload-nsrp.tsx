// ============================================================
// Upload NSRP Form + OCR-assisted NSRP review (combined)
// OCR is OPTIONAL & ASSISTIVE - User must review/confirm before saving.
// ============================================================
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, Alert, KeyboardAvoidingView, Platform, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Button, Card, BackLink } from '../../src/components/ui';
import { NsrpForm } from '../../src/components/NsrpForm';
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

// True when OCR actually read something (empty rows/objects from a page that wasn't scanned don't count).
const hasMergeValue = (value: any): boolean => {
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.some(hasMergeValue);
  if (value && typeof value === 'object') return Object.values(value).some(hasMergeValue);
  return String(value ?? '').trim().length > 0;
};

// Education levels and language rows are merged one level/row at a time.
const mergeNested = (previous: any, incoming: any) => {
  const merged = { ...(previous || {}) };
  Object.entries(incoming || {}).forEach(([key, value]) => {
    if (hasMergeValue(value)) merged[key] = value;
  });
  return merged;
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
    if (!hasMergeValue(value)) return;
    merged.nsrp_full_data[key] = (key === 'education' || key === 'languages')
      ? mergeNested(merged.nsrp_full_data[key], value)
      : value;
  });

  return merged;
};

export default function UploadNSRP() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploadId, setUploadId] = useState<number | null>(null);
  // Every page scanned into the current review (page 1 and page 2 are confirmed together).
  const [reviewUploadIds, setReviewUploadIds] = useState<number[]>([]);
  const [extracted, setExtracted] = useState<any | null>(null);
  // The saved profile: OCR results are merged on top of it, so scanning one page never blanks the other page's fields.
  const [savedProfile, setSavedProfile] = useState<any | null>(null);

  // Reloaded on every focus: this hidden tab stays mounted, and the profile may have been edited since.
  useFocusEffect(useCallback(() => {
    api.get('/job-seeker/profile')
      .then((res) => {
        const prof = res.data.profile || {};
        let full = prof.nsrp_full_data || {};
        if (typeof full === 'string') {
          try { full = JSON.parse(full); } catch { full = {}; }
        }
        const base: any = {};
        Object.keys(emptyExtracted).forEach((k) => {
          if (k !== 'nsrp_full_data' && prof[k] != null) base[k] = prof[k];
        });
        setSavedProfile({ ...emptyExtracted, ...base, nsrp_full_data: { ...defaultNsrpFullData, ...full } });
      })
      .catch(() => setSavedProfile(null));
  }, []));
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
    setReviewUploadIds([]);
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
    if (!extracted) {
      setUploadId(null);
      setReviewUploadIds([]);
    }
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
    if (ocrStatus === 'not_nsrp') return 'This is not an NSRP Form 1 page';
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
      setReviewUploadIds((ids) => [...ids, newUploadId]);
      setUploading(false);
      setExtracting(true);
      stage = 'extract';
      const exRes = await api.post('/nsrp/extract', { upload_id: newUploadId }, { timeout: OCR_EXTRACT_TIMEOUT_MS });
      const nextStatus = exRes.data.ocr_status || (exRes.data.success ? 'fields_extracted' : 'no_text');
      const nextFieldCount = Number(exRes.data.field_count || 0);
      const nextPageType = exRes.data.page_type || '';
      setExtracted((current: any) => mergeExtractedData(current || savedProfile, exRes.data.extracted_data));
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
      setExtracted((current: any) => current || savedProfile || emptyExtracted);
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

  const confirmAndSave = async () => {
    if (!extracted) return;
    setConfirming(true);
    try {
      await api.post('/nsrp/confirm', { upload_id: uploadId, upload_ids: reviewUploadIds, confirmed_data: extracted });
      clearAll();
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
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.lightBg }} edges={['left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 12 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <BackLink testID="ocr-back" label="Profile" onPress={() => router.navigate('/(seeker)/profile')} />
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

                <Text style={styles.reviewHint}>
                  Review every field below against your paper form. Fix anything the OCR read wrong, then confirm.
                </Text>
              </Card>
            )}
            {extracted && <NsrpForm value={extracted} onChange={setExtracted} idPrefix="rev" />}
            {extracted && (
              <Card style={styles.reviewCard}>
                <View style={{ marginTop: Spacing.sm }}>
                  <Button testID="confirm-save" title="Confirm and Save" onPress={confirmAndSave} loading={confirming} />
                </View>
              </Card>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.lightBg },
  content: { paddingBottom: 0 },
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
  captureCard: { marginBottom: Spacing.xs },
  noticeCard: { backgroundColor: Colors.cardHighlight, marginBottom: Spacing.sm },
  reviewCard: { marginTop: Spacing.sm },
  reviewHint: { fontSize: FontSize.sm, color: Colors.textDark, lineHeight: 20, marginTop: Spacing.sm },
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
