// ============================================================
// NSRP Form Upload + OCR Routes
// OCR is optional and assistive only.
// - Extracted data is placed into editable fields only.
// - The user must review, edit, and manually confirm before save.
// - OCR does not validate identity, screen, rank, recommend, or decide.
// ============================================================
const express = require('express');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const nsrpOcr = require('../services/nsrpOcr');

const router = express.Router();
router.use(authenticate, requireRole('job_seeker'));

const OCR_MAX_IMAGE_BYTES = 18 * 1024 * 1024;

function detectImageType(buffer) {
  if (!buffer || buffer.length < 12) return '';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  if (buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer.slice(0, 3).toString('ascii') === 'GIF') return 'gif';
  if (buffer.slice(0, 2).toString('ascii') === 'BM') return 'bmp';
  if (buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP') return 'webp';
  if (buffer.slice(0, 2).toString('ascii') === 'P1' || buffer.slice(0, 2).toString('ascii') === 'P4') return 'pbm';
  return '';
}

function stripImageDataUrl(imageBase64) {
  return String(imageBase64 || '').replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
}

async function getJobSeekerId(userId) {
  const [rows] = await db.query('SELECT id FROM job_seekers WHERE user_id = ?', [userId]);
  return rows[0]?.id || null;
}

function hasUsableRegionText(ocrRegions) {
  return Object.entries(ocrRegions || {})
    .some(([key, value]) => key !== '__checkboxes' && typeof value === 'string' && value.trim().length > 0);
}

function ocrFailureStatus(errorMessage) {
  if (!errorMessage) return 'no_text';
  return /timed out/i.test(errorMessage) ? 'timeout' : 'backend_error';
}

async function storeOcrResult(uploadId, payload) {
  try {
    await db.query(
      'UPDATE uploaded_nsrp_forms SET ocr_extracted_data = ? WHERE id = ?',
      [JSON.stringify(payload), uploadId],
    );
  } catch (_) {
    // OCR cache write failure must not block manual encoding/review.
  }
}

// POST /api/nsrp/upload
router.post('/upload', async (req, res) => {
  const { image_base64 } = req.body;
  if (!image_base64) return res.status(400).json({ error: 'image_base64 is required' });

  try {
    const jsId = await getJobSeekerId(req.user.id);
    if (!jsId) return res.status(404).json({ error: 'Profile not found' });

    const [result] = await db.query(
      'INSERT INTO uploaded_nsrp_forms (job_seeker_id, image_base64, ocr_confirmed) VALUES (?, ?, FALSE)',
      [jsId, image_base64],
    );
    res.status(201).json({ message: 'NSRP form uploaded', upload_id: result.insertId });
  } catch (err) {
    console.error('[NSRP Upload]', err);
    res.status(500).json({ error: 'Failed to upload NSRP form' });
  }
});

// POST /api/nsrp/extract
router.post('/extract', async (req, res) => {
  const { upload_id } = req.body;
  const emptyEditable = nsrpOcr.emptyEditable();

  let jsId;
  try {
    jsId = await getJobSeekerId(req.user.id);
  } catch (err) {
    console.error('[NSRP Extract profile]', err);
    return res.status(500).json({ error: 'Failed to load profile' });
  }
  if (!jsId) return res.status(404).json({ error: 'Profile not found' });

  let imageBuffer = null;
  try {
    if (!upload_id) return res.status(400).json({ error: 'upload_id is required' });
    const [rows] = await db.query(
      'SELECT id, image_base64 FROM uploaded_nsrp_forms WHERE id = ? AND job_seeker_id = ?',
      [upload_id, jsId],
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Upload not found' });

    const b64 = stripImageDataUrl(rows[0].image_base64);
    imageBuffer = Buffer.from(b64, 'base64');
    if (imageBuffer.length === 0) throw new Error('Empty image data');
    if (imageBuffer.length > OCR_MAX_IMAGE_BYTES) {
      return res.status(413).json({ error: 'NSRP image is too large for OCR. Please upload a clearer compressed JPEG or PNG.' });
    }
    if (!detectImageType(imageBuffer)) {
      return res.status(400).json({ error: 'Unsupported image format. Please upload a JPEG, PNG, BMP, GIF, WebP, or PBM image.' });
    }
  } catch (err) {
    console.error('[NSRP Extract pre]', err);
    return res.status(400).json({ error: 'Could not load uploaded image' });
  }

  let Tesseract;
  try {
    Tesseract = require('tesseract.js');
  } catch (_) {
    return res.json({
      success: false,
      extracted_data: emptyEditable,
      raw_text: '',
      ocr_regions: {},
      ocr_status: 'backend_error',
      field_count: 0,
      notice: 'OCR engine unavailable. Please encode the NSRP-based profile manually below.',
      error_message: 'tesseract.js not installed',
    });
  }

  let rawText = '';
  let ocrRegions = {};
  let ocrError = null;
  try {
    const ocrResult = await nsrpOcr.recognizeNsrpImage(Tesseract, imageBuffer);
    rawText = ocrResult.rawText || '';
    ocrRegions = ocrResult.regions || {};
  } catch (err) {
    ocrError = err.message || 'OCR failed';
    console.warn('[NSRP OCR]', ocrError);
  }

  if ((!rawText || rawText.trim().length === 0) && !hasUsableRegionText(ocrRegions)) {
    const ocrStatus = ocrFailureStatus(ocrError);
    await storeOcrResult(upload_id, { raw_text: '', regions: ocrRegions, parsed: emptyEditable, ocr_status: ocrStatus });
    return res.json({
      success: false,
      extracted_data: emptyEditable,
      raw_text: '',
      ocr_regions: ocrRegions,
      ocr_status: ocrStatus,
      field_count: 0,
      notice: ocrStatus === 'timeout'
        ? 'OCR timed out before the backend finished reading the form. Please try a clearer compressed image or encode manually below.'
        : 'OCR could not extract text from this image. Please encode the NSRP-based profile manually below.',
      error_message: ocrError || 'No text detected',
    });
  }

  const parsed = nsrpOcr.parseNsrpText(rawText, ocrRegions);
  const fieldCount = nsrpOcr.countExtractedFields(parsed);
  const ocrStatus = fieldCount > 0 ? 'fields_extracted' : 'no_fields';

  await storeOcrResult(upload_id, { raw_text: rawText, regions: ocrRegions, parsed, ocr_status: ocrStatus, field_count: fieldCount });

  return res.json({
    success: fieldCount > 0,
    extracted_data: parsed,
    raw_text: rawText,
    ocr_regions: ocrRegions,
    ocr_status: ocrStatus,
    field_count: fieldCount,
    notice: fieldCount > 0
      ? 'OCR is assistive only. Extracted text has been placed into editable fields. Please review, edit, and manually confirm every field before saving. OCR does not validate, rank, screen, recommend, or decide for any applicant.'
      : 'OCR ran, but no reliable NSRP fields could be extracted. Please encode the NSRP-based profile manually below.',
  });
});

// POST /api/nsrp/confirm
router.post('/confirm', async (req, res) => {
  const { upload_id, confirmed_data } = req.body;
  if (!confirmed_data) return res.status(400).json({ error: 'confirmed_data is required' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const jsId = await getJobSeekerId(req.user.id);
    if (!jsId) {
      await conn.rollback();
      return res.status(404).json({ error: 'Profile not found' });
    }

    const d = confirmed_data;
    const profileCompleted = !!(d.first_name && d.last_name && d.date_of_birth && d.contact_number && d.city);
    const [[current]] = await conn.query('SELECT referral_status FROM job_seekers WHERE id = ?', [jsId]);
    const nextReferralStatus = current?.referral_status === 'submitted' ? 'submitted' : 'draft';
    const nsrpFullData = d.nsrp_full_data ? JSON.stringify(d.nsrp_full_data) : null;

    await conn.query(
      `UPDATE job_seekers SET
         first_name=?, middle_name=?, last_name=?, date_of_birth=?, gender=?,
         civil_status=?, contact_number=?, address=?, city=?, province=?,
         education_level=?, course=?, years_of_experience=?, employment_status=?,
         preferred_occupation=?, nsrp_full_data=COALESCE(?, nsrp_full_data),
         profile_completed=?, referral_status=?,
         referral_review_notes=NULL, referral_reviewed_by=NULL, referral_reviewed_at=NULL
       WHERE id=?`,
      [
        d.first_name || null, d.middle_name || null, d.last_name || null,
        d.date_of_birth || null, d.gender || null, d.civil_status || null,
        d.contact_number || null, d.address || null, d.city || null,
        d.province || null, d.education_level || null, d.course || null,
        d.years_of_experience || 0, d.employment_status || null,
        d.preferred_occupation || null,
        nsrpFullData, profileCompleted, nextReferralStatus, jsId,
      ],
    );

    if (upload_id) {
      await conn.query(
        'UPDATE uploaded_nsrp_forms SET ocr_confirmed = TRUE WHERE id = ? AND job_seeker_id = ?',
        [upload_id, jsId],
      );
    }

    await conn.commit();
    res.json({ message: 'NSRP data confirmed and saved to profile' });
  } catch (err) {
    await conn.rollback();
    console.error('[NSRP Confirm]', err);
    res.status(500).json({ error: 'Failed to save confirmed data' });
  } finally {
    conn.release();
  }
});

module.exports = router;
