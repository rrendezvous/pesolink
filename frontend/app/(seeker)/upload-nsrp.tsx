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

export default function UploadNSRP() {
  const router = useRouter();
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploadId, setUploadId] = useState<number | null>(null);
  const [extracted, setExtracted] = useState<any | null>(null);
  const [ocrSuccess, setOcrSuccess] = useState<boolean | null>(null);
  const [ocrMessage, setOcrMessage] = useState('');
  const [rawText, setRawText] = useState('');
  const [showRawText, setShowRawText] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const resetReview = () => {
    setUploadId(null);
    setExtracted(null);
    setOcrSuccess(null);
    setOcrMessage('');
    setRawText('');
    setShowRawText(false);
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission required', 'Please allow gallery access to pick the NSRP form image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.5,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setImageBase64(`data:image/jpeg;base64,${asset.base64}`);
      setImageUri(asset.uri);
      resetReview();
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
      quality: 0.5,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setImageBase64(`data:image/jpeg;base64,${asset.base64}`);
      setImageUri(asset.uri);
      resetReview();
    }
  };

  const uploadAndExtract = async () => {
    if (!imageBase64) {
      Alert.alert('No image', 'Please pick or capture an NSRP form first.');
      return;
    }
    setUploading(true);
    setOcrSuccess(null);
    setOcrMessage('');
    setRawText('');
    setShowRawText(false);
    try {
      const upRes = await api.post('/nsrp/upload', { image_base64: imageBase64 });
      const newUploadId = upRes.data.upload_id;
      setUploadId(newUploadId);
      setUploading(false);
      setExtracting(true);
      const exRes = await api.post('/nsrp/extract', { upload_id: newUploadId }, { timeout: 60000 });
      setExtracted(exRes.data.extracted_data);
      setRawText(exRes.data.raw_text || '');
      setOcrSuccess(!!exRes.data.success);
      setOcrMessage(exRes.data.notice || exRes.data.error_message || '');
    } catch (err) {
      setExtracted({
        first_name: '', middle_name: '', last_name: '',
        date_of_birth: '', gender: '', civil_status: '',
        contact_number: '', address: '', city: '', province: '',
        education_level: '', course: '', years_of_experience: 0,
        employment_status: '', preferred_occupation: '',
      });
      setOcrSuccess(false);
      setOcrMessage('OCR could not be reached. You can still encode the NSRP-based profile manually below.');
    } finally {
      setUploading(false);
      setExtracting(false);
    }
  };

  const setField = (k: string, v: any) => setExtracted((p: any) => ({ ...p, [k]: v }));

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
              <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
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
                  <Text style={styles.warningTitle}>OCR did not extract usable text</Text>
                  <Text style={styles.warningText}>
                    {ocrMessage || 'Please encode each NSRP field manually below.'}
                  </Text>
                </View>
              ) : (
                <Text style={styles.noticeInline}>
                  {ocrMessage || 'Please review every field. Edit anything incorrect before confirming.'}
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
                </View>
              )}

              <Input testID="rev-first" label="First Name" value={extracted.first_name || ''} onChangeText={(v) => setField('first_name', v)} autoCapitalize="words" />
              <Input testID="rev-middle" label="Middle Name" value={extracted.middle_name || ''} onChangeText={(v) => setField('middle_name', v)} autoCapitalize="words" />
              <Input testID="rev-last" label="Last Name" value={extracted.last_name || ''} onChangeText={(v) => setField('last_name', v)} autoCapitalize="words" />
              <Input testID="rev-dob" label="Date of Birth (YYYY-MM-DD)" value={extracted.date_of_birth || ''} onChangeText={(v) => setField('date_of_birth', v)} />
              <Input testID="rev-gender" label="Gender" value={extracted.gender || ''} onChangeText={(v) => setField('gender', v)} />
              <Input testID="rev-civil" label="Civil Status" value={extracted.civil_status || ''} onChangeText={(v) => setField('civil_status', v)} />
              <Input testID="rev-contact" label="Contact Number" value={extracted.contact_number || ''} onChangeText={(v) => setField('contact_number', v)} keyboardType="phone-pad" />
              <Input testID="rev-address" label="Address" value={extracted.address || ''} onChangeText={(v) => setField('address', v)} multiline numberOfLines={2} />
              <Input testID="rev-city" label="City" value={extracted.city || ''} onChangeText={(v) => setField('city', v)} autoCapitalize="words" />
              <Input testID="rev-province" label="Province" value={extracted.province || ''} onChangeText={(v) => setField('province', v)} autoCapitalize="words" />
              <Input testID="rev-edu" label="Education Level" value={extracted.education_level || ''} onChangeText={(v) => setField('education_level', v)} />
              <Input testID="rev-course" label="Course" value={extracted.course || ''} onChangeText={(v) => setField('course', v)} />
              <Input testID="rev-occ" label="Preferred Occupation" value={extracted.preferred_occupation || ''} onChangeText={(v) => setField('preferred_occupation', v)} autoCapitalize="words" />

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
});
