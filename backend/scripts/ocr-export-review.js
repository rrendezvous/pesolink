'use strict';

// Exports one test account's OCR scans for scoring: for each scanned page, what the OCR first read, next to the
// profile the person saved after correcting every field to match the paper (the correct answers). Read-only.
// Run it after scanning, correcting and pressing Confirm and Save in the app, against the TEST database only:
//   set DB_HOST=127.0.0.1
//   set DB_NAME=peso_link_test
//   node scripts/ocr-export-review.js <test-account-email>
// Writes ocr-review-<email>.json in the current folder. Send that file together with the original photos.
const fs = require('fs');
const mysql = require('mysql2/promise');
require('dotenv').config();

const email = String(process.argv[2] || '').trim().toLowerCase();
if (!email) {
  console.error('Usage: node scripts/ocr-export-review.js <test-account-email>');
  process.exit(1);
}
if (process.env.DB_NAME === 'peso_link_misor') {
  console.error('Refusing to read the real database. Use the test database (DB_NAME=peso_link_test).');
  process.exit(1);
}

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    dateStrings: ['DATE'],
  });
  const [seekers] = await conn.query(
    'SELECT js.* FROM job_seekers js JOIN users u ON u.id = js.user_id WHERE LOWER(u.email) = ?',
    [email],
  );
  if (!seekers.length) {
    console.error(`No job seeker account with email ${email} in ${process.env.DB_NAME}.`);
    await conn.end();
    process.exit(1);
  }
  const saved = seekers[0];
  const [uploads] = await conn.query(
    'SELECT id, uploaded_at, ocr_confirmed, ocr_extracted_data FROM uploaded_nsrp_forms WHERE job_seeker_id = ? ORDER BY id',
    [saved.id],
  );
  await conn.end();
  const parse = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
  const scans = uploads.filter((u) => u.ocr_extracted_data).map((u) => {
    const d = parse(u.ocr_extracted_data);
    return {
      upload_id: u.id,
      uploaded_at: u.uploaded_at,
      confirmed: !!u.ocr_confirmed,
      page_type: d.page_type,
      ocr_status: d.ocr_status,
      located: d.regions?.__alignment || null,
      review_flags: d.review_flags || [],
      ocr_read: d.parsed,
      ocr_box_text: Object.fromEntries(Object.entries(d.regions || {}).filter(([k]) => !k.startsWith('__'))),
    };
  });
  const { id, user_id: userId, ...profile } = saved;
  profile.nsrp_full_data = parse(profile.nsrp_full_data);
  const out = { email, database: process.env.DB_NAME, exported_at: new Date().toISOString(), saved_profile: profile, scans };
  const file = `ocr-review-${email.replace(/[^a-z0-9.@_-]/g, '_')}.json`;
  fs.writeFileSync(file, JSON.stringify(out, null, 1));
  console.log(`Wrote ${file}: ${scans.length} scanned page(s). Send it with the original photos.`);
})().catch((err) => { console.error(err.message); process.exit(1); });
