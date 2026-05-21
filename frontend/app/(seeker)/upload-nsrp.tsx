// ============================================================
// Upload NSRP Form + Simulated OCR Review (combined)
// OCR is OPTIONAL & ASSISTIVE - User must review/confirm before saving.
// ============================================================
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Button, Input, Card } from '../../src/components/ui';
import { api, getApiError } from '../../src/api/client';
import { Colors, Spacing, FontSize } from '../../src/constants/theme';

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
      setUploadId(null);
      setExtracted(null);
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
      setUploadId(null);
      setExtracted(null);
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
      // Network-level failure: still show empty editable fields for manual encoding
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
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <Card style={{ backgroundColor: Colors.surface }}>
          <Text style={styles.notice}>
            <Text style={{ fontWeight: '700' }}>OCR Notice: </Text>
            OCR is optional and assistive only. It extracts raw text from the uploaded NSRP form image
            and places it into editable fields. OCR does not auto-save, validate, decide, rank, or screen
            applicants. You must review, edit, and manually confirm every field before saving. If OCR
            fails or returns incomplete results, you can still encode the NSRP profile manually below.
          </Text>
        </Card>

        <Card>
          <Text style={styles.section}>Step 1: Upload NSRP Form Image</Text>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
          ) : (
            <View style={styles.placeholder}>
              <Text style={{ color: Colors.gray, textAlign: 'center' }}>No image selected</Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: Spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button testID="pick-image" title="Choose from Gallery" variant="secondary" onPress={pickImage} />
            </View>
            <View style={{ flex: 1 }}>
              <Button testID="take-photo" title="Take Photo" variant="secondary" onPress={takePhoto} />
            </View>
          </View>
          <View style={{ marginTop: Spacing.sm }}>
            <Button
              testID="upload-extract"
              title={uploading ? 'Uploading...' : extracting ? 'Extracting (Simulated OCR)...' : 'Upload & Extract'}
              onPress={uploadAndExtract}
              loading={uploading || extracting}
              disabled={!imageBase64}
            />
          </View>
        </Card>

        {extracted && (
          <Card>
            <Text style={styles.section}>Step 2: Review & Confirm</Text>
            {ocrSuccess === false ? (
              <View style={{ backgroundColor: '#FEF3C7', borderColor: '#F59E0B', borderWidth: 1, padding: 10, borderRadius: 8, marginBottom: Spacing.sm }}>
                <Text style={{ fontWeight: '700', color: '#92400E', fontSize: FontSize.sm }}>OCR did not extract usable text</Text>
                <Text style={{ color: '#92400E', fontSize: FontSize.xs, marginTop: 4, lineHeight: 16 }}>
                  {ocrMessage || 'Please encode each NSRP field manually below.'}
                </Text>
              </View>
            ) : (
              <Text style={styles.noticeInline}>
                {ocrMessage || 'Please review every field. Edit anything incorrect before confirming.'}
              </Text>
            )}

            {!!rawText && (
              <TouchableOpacity onPress={() => setShowRawText((v) => !v)} testID="toggle-raw-text" style={{ marginBottom: Spacing.sm }}>
                <Text style={{ color: Colors.primary, fontSize: FontSize.xs, fontWeight: '600' }}>
                  {showRawText ? '▼' : '▶'} View raw extracted text (transparency)
                </Text>
              </TouchableOpacity>
            )}
            {showRawText && !!rawText && (
              <View style={{ backgroundColor: Colors.surface, padding: 8, borderRadius: 6, marginBottom: Spacing.sm }}>
                <Text style={{ fontSize: FontSize.xs, color: Colors.gray, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
                  {rawText}
                </Text>
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
              <Button testID="confirm-save" title="Confirm & Save to Profile" onPress={confirmAndSave} loading={confirming} />
            </View>
          </Card>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.lightBg, padding: Spacing.md },
  notice: { fontSize: FontSize.xs, color: Colors.textDark, lineHeight: 18 },
  noticeInline: { fontSize: FontSize.xs, color: Colors.warning, marginBottom: 8, fontWeight: '600' },
  section: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark, marginBottom: Spacing.sm },
  preview: { width: '100%', height: 220, borderRadius: 10, backgroundColor: Colors.white, borderColor: Colors.border, borderWidth: 1 },
  placeholder: {
    height: 160, borderWidth: 2, borderStyle: 'dashed', borderColor: Colors.border,
    borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.white,
  },
});
