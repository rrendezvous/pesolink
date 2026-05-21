// ============================================================
// NSRP Form Upload + OCR Routes
// OCR is OPTIONAL & ASSISTIVE only.
// - OCR extracts raw text from the uploaded NSRP form image.
// - Extracted data is placed into EDITABLE fields only — never auto-saved.
// - The user must review, edit, and manually confirm via /confirm before save.
// - OCR does NOT validate identity, rank, screen, or make any hiring decision.
// - Real OCR engine: tesseract.js. If OCR fails or returns empty text, the
//   API still returns 200 with empty editable fields so the user can encode
//   the NSRP-based profile manually.
// ============================================================
const express = require('express');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireRole('job_seeker'));

async function getJobSeekerId(userId) {
  const [rows] = await db.query('SELECT id FROM job_seekers WHERE user_id = ?', [userId]);
  return rows[0]?.id || null;
}

// POST /api/nsrp/upload - upload NSRP form image (base64)
router.post('/upload', async (req, res) => {
  const { image_base64 } = req.body;
  if (!image_base64) return res.status(400).json({ error: 'image_base64 is required' });

  try {
    const jsId = await getJobSeekerId(req.user.id);
    if (!jsId) return res.status(404).json({ error: 'Profile not found' });

    const [result] = await db.query(
      `INSERT INTO uploaded_nsrp_forms (job_seeker_id, image_base64, ocr_confirmed)
       VALUES (?, ?, FALSE)`,
      [jsId, image_base64]
    );

    res.status(201).json({
      message: 'NSRP form uploaded',
      upload_id: result.insertId,
    });
  } catch (err) {
    console.error('[NSRP Upload]', err);
    res.status(500).json({ error: 'Failed to upload NSRP form' });
  }
});

// Build editable fields from raw OCR text using simple, transparent regex rules.
// This is text extraction only — no automated validation or decisioning.
function parseNsrpText(rawText) {
  const text = (rawText || '').replace(/\r/g, '');
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // Helper: find the first value after a label like "First Name:" or "Name :"
  function pickAfter(labels) {
    for (const line of lines) {
      for (const lbl of labels) {
        const re = new RegExp(`${lbl}\\s*[:\\-]\\s*(.+)`, 'i');
        const m = line.match(re);
        if (m && m[1]) return m[1].trim();
      }
    }
    return '';
  }

  // Date in formats like 1998-05-15 or 05/15/1998 or May 15, 1998
  function pickDate() {
    const dateRe = /(\d{4}-\d{2}-\d{2})|(\d{1,2}\/\d{1,2}\/\d{4})|([A-Za-z]+ \d{1,2},? \d{4})/;
    const m = text.match(dateRe);
    if (!m) return '';
    const raw = m[0];
    try {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    } catch {}
    return raw;
  }

  // PH phone: 09xxxxxxxxx or +639xxxxxxxxx
  function pickPhone() {
    const m = text.match(/(\+?63\s?9\d{2}\s?\d{3}\s?\d{4})|(09\d{9})/);
    return m ? m[0].replace(/\s+/g, '') : '';
  }

  return {
    first_name: pickAfter(['First Name', 'Given Name']),
    middle_name: pickAfter(['Middle Name']),
    last_name: pickAfter(['Last Name', 'Surname', 'Family Name']),
    date_of_birth: pickDate(),
    gender: (pickAfter(['Sex', 'Gender']) || '').toLowerCase().match(/(male|female|other)/)?.[1] || '',
    civil_status: (pickAfter(['Civil Status']) || '').toLowerCase().match(/(single|married|widowed|separated)/)?.[1] || '',
    contact_number: pickPhone() || pickAfter(['Contact', 'Phone', 'Mobile']),
    address: pickAfter(['Address', 'Permanent Address', 'Residence']),
    city: pickAfter(['City', 'Municipality']),
    province: pickAfter(['Province']),
    education_level: pickAfter(['Education', 'Educational Attainment', 'Level']),
    course: pickAfter(['Course', 'Degree', 'Field of Study']),
    years_of_experience: parseInt((pickAfter(['Years of Experience', 'Experience']) || '0').replace(/[^0-9]/g, ''), 10) || 0,
    employment_status: (pickAfter(['Employment Status']) || '').toLowerCase().match(/(unemployed|underemployed|employed)/)?.[1] || '',
    preferred_occupation: pickAfter(['Preferred Occupation', 'Desired Job', 'Preferred Job']),
  };
}

// POST /api/nsrp/extract - REAL OCR via tesseract.js
// Returns: { success, extracted_data (editable), raw_text, notice, error_message? }
router.post('/extract', async (req, res) => {
  const { upload_id } = req.body;

  const jsId = await getJobSeekerId(req.user.id);
  if (!jsId) return res.status(404).json({ error: 'Profile not found' });

  let imageBuffer = null;
  try {
    if (!upload_id) {
      return res.status(400).json({ error: 'upload_id is required' });
    }
    const [rows] = await db.query(
      'SELECT id, image_base64 FROM uploaded_nsrp_forms WHERE id = ? AND job_seeker_id = ?',
      [upload_id, jsId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Upload not found' });

    let b64 = rows[0].image_base64 || '';
    b64 = b64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
    imageBuffer = Buffer.from(b64, 'base64');
    if (imageBuffer.length === 0) throw new Error('Empty image data');
  } catch (err) {
    console.error('[NSRP Extract pre]', err);
    return res.status(400).json({ error: 'Could not load uploaded image' });
  }

  // Empty editable scaffold (always editable on the client)
  const emptyEditable = {
    first_name: '', middle_name: '', last_name: '',
    date_of_birth: '', gender: '', civil_status: '',
    contact_number: '', address: '', city: '', province: '',
    education_level: '', course: '', years_of_experience: 0,
    employment_status: '', preferred_occupation: '',
  };

  // Lazy-load tesseract.js to avoid slowing server startup
  let Tesseract;
  try {
    Tesseract = require('tesseract.js');
  } catch (e) {
    return res.json({
      success: false,
      extracted_data: emptyEditable,
      raw_text: '',
      notice: 'OCR engine unavailable. Please encode the NSRP-based profile manually below.',
      error_message: 'tesseract.js not installed',
    });
  }

  // Run OCR with timeout (45s)
  let raw_text = '';
  let ocrError = null;
  try {
    const ocrPromise = Tesseract.recognize(imageBuffer, 'eng', { logger: () => {} })
      .then((r) => r.data?.text || '');
    raw_text = await Promise.race([
      ocrPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('OCR timed out')), 45000)),
    ]);
  } catch (err) {
    ocrError = err.message || 'OCR failed';
    console.warn('[NSRP OCR]', ocrError);
  }

  if (!raw_text || raw_text.trim().length === 0) {
    // Persist empty result so we still have audit trail; user encodes manually.
    try {
      await db.query(
        'UPDATE uploaded_nsrp_forms SET ocr_extracted_data = ? WHERE id = ?',
        [JSON.stringify({ raw_text: '', parsed: emptyEditable }), upload_id]
      );
    } catch {}
    return res.json({
      success: false,
      extracted_data: emptyEditable,
      raw_text: '',
      notice:
        'OCR could not extract text from this image. Please encode the NSRP-based profile manually below. ' +
        'You can still upload a clearer image and try again, or proceed with manual encoding.',
      error_message: ocrError || 'No text detected',
    });
  }

  const parsed = parseNsrpText(raw_text);

  try {
    await db.query(
      'UPDATE uploaded_nsrp_forms SET ocr_extracted_data = ? WHERE id = ?',
      [JSON.stringify({ raw_text, parsed }), upload_id]
    );
  } catch {}

  return res.json({
    success: true,
    extracted_data: parsed,
    raw_text,
    notice:
      'OCR is assistive only. Extracted text has been placed into editable fields. ' +
      'Please review, edit, and manually confirm every field before saving. ' +
      'OCR does not validate, rank, or decide for any applicant.',
  });
});

// POST /api/nsrp/confirm - user-confirmed OCR data saved to profile
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
         preferred_occupation=?, nsrp_full_data=COALESCE(?, nsrp_full_data), profile_completed=?, referral_status=?, referral_review_notes=NULL,
         referral_reviewed_by=NULL, referral_reviewed_at=NULL
       WHERE id=?`,
      [
        d.first_name || null, d.middle_name || null, d.last_name || null,
        d.date_of_birth || null, d.gender || null, d.civil_status || null,
        d.contact_number || null, d.address || null, d.city || null,
        d.province || null, d.education_level || null, d.course || null,
        d.years_of_experience || 0, d.employment_status || null,
        d.preferred_occupation || null,
        nsrpFullData,
        profileCompleted, nextReferralStatus, jsId,
      ]
    );

    if (upload_id) {
      await conn.query(
        'UPDATE uploaded_nsrp_forms SET ocr_confirmed = TRUE WHERE id = ? AND job_seeker_id = ?',
        [upload_id, jsId]
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
