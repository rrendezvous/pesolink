# PESO-Link MisOr

PESO-Link MisOr is an Android-focused mobile employment facilitation system for PESO Misamis Oriental. It is a BSIT capstone prototype built with React Native Expo, Node.js Express, and MySQL.

The app centralizes job seeker registration, NSRP-based profile encoding, optional OCR-assisted NSRP form prefill, employer job posting, job browsing, application tracking, notifications, and PESO admin monitoring.

## Project Scope

The submitted system is:

- Android-focused mobile app using Expo React Native.
- REST API backend using Node.js, Express, JWT authentication, and MySQL.
- Runs locally or on a LAN for development and demos, and was also deployed on a cloud server (Azure virtual machine) with a release APK for the evaluation.
- OCR-assisted NSRP encoding using Tesseract.js, with PaddleOCR (PP-OCRv5 text recognition) as an optional second reader on the same server, as the emerging technology. Both are open-source and run on the project's own backend; form images are not sent to outside services.

The submitted system is not:

- A replacement for official PESO, PEIS, PhilJobNet, or NSRP processing.
- A hiring decision system.
- An AI screening, ranking, or recommendation system.
- A chat, payment, GPS, biometric login, interview scheduling, or external government database integration system.

## Main Features

### Job Seeker

- Register and log in.
- Create and update an NSRP-based job seeker profile laid out like NSRP Form 1 (DOLE, January 2017): sections I-VIII with the form's checklists and table rows (education, training, eligibility/license, work experience, other skills).
- Optionally scan NSRP form page 1 and page 2 using OCR.
- Review and edit all OCR-filled fields before saving.
- Save selected skills for rule-based job comparison.
- View the required NSRP fields checklist, then submit the NSRP profile to PESO for a one-time verification.
- Browse active job postings.
- Search and filter jobs by keyword, job type, and location.
- View job details, requirements, application instructions, optional application email, employer details, and skill comparison.
- Once PESO-verified, apply to any job with one tap (Apply with PESO Referral); the application reaches the employer as PESO-Referred.
- Optional skill minimum (`MIN_SKILL_MATCHES`): the number of the job's required skills that must match before applying, capped at the job's own skill count. The code default is 3; the deployed server uses 0 (rule off) since 2026-11-03, so any PESO-verified job seeker can apply while the skill comparison is still shown.
- Changing a verified NSRP profile sends it back to PESO for re-checking.
- Track applications and employer status with a full status history.
- View notifications.

### Employer

- Log in using a PESO Admin-created or approved employer account.
- View employer dashboard and notifications.
- Create job postings.
- Update job postings.
- Encode requirements/application instructions and an optional application email for direct applications.
- Select required skills for rule-based comparison.
- Soft-close job postings while keeping records for monitoring.
- View PESO-referred applicants for own job postings (only job seekers whose NSRP profile PESO verified).
- View applicant NSRP profile summary, contact information, PESO note, matched skills, missing required skills, and application status.
- Manually update application status: For Review, For Interview, Hired, or Rejected.

### PESO Admin

- Log in using admin credentials.
- View dashboard statistics.
- Create employer accounts.
- Approve or reject employer accounts when applicable.
- Create, approve/reject, edit, deactivate, and reactivate employer accounts (deactivating closes the employer's active job posts and notifies those applicants).
- View job seeker accounts.
- Deactivate/reactivate job seeker accounts (deactivating closes the seeker's in-progress applications and notifies the employers).
- View the job seeker's uploaded NSRP form image next to the encoded profile, and record the form's "For use of PESO only" eligibility (SPES, GIP, TUPAD, JobStart, others) when verifying.
- Verify each job seeker's NSRP profile once (Verify, or Return for Revision with a note); changed profiles come back for re-checking.
- Deactivate job seeker accounts with invalid information.
- Monitor job postings.
- Soft-close job postings (in-progress applications for the job are marked Closed and the applicants are notified; this is not a rejection, and Hired stays Hired).
- Search and filter all applications.
- View PESO Admin notifications (for example, NSRP profiles submitted, resubmitted, or changed after verification).

## Important Workflow Explanation

PESO verifies each job seeker's NSRP profile once; verified job seekers then apply to any job with one tap.
(This replaced the per-job PESO review described in proposal V11.49.)

1. **NSRP-Based Profile (one per job seeker)**
   - The job seeker completes the 19 required NSRP items (manually or with optional OCR assistance), ticks the certification, and taps **Save and Submit to PESO** (**Save and Resubmit to PESO** after a return).

2. **NSRP Status - updated by PESO Admin, once**
   - `not_submitted` - incomplete or not yet sent to PESO.
   - `submitted` - waiting for PESO.
   - `for_review` - recorded automatically when PESO Admin opens the profile.
   - `verified` - PESO-Verified; the job seeker can apply to any job.
   - `needs_revision` - returned with a note; the job seeker fixes it and resubmits.
   - Any change to a verified profile (fields or skills) sends it back to `submitted` for re-checking.

3. **Applying** - a verified job seeker taps **Apply with PESO Referral**. The application is created as `peso_referred` and the employer is notified right away.
   - Optional skill minimum: at least `MIN_SKILL_MATCHES` (code default 3) of the job's required skills must match, capped at the job's own required-skill count. The deployed server sets it to 0 (rule off).

4. **Application Status - updated by the employer**
   - `for_review`, `for_interview`, `hired`, `rejected`
   - `closed` is set by the system when the job post is closed or an account is deactivated (not a rejection).

PESO-Verified, PESO-Referred, and Hired are tracking labels, not automated decisions.

## OCR Workflow

OCR is optional and assistive only.

1. Job seeker opens **Profile**, then **Fill from a scanned NSRP form (OCR Assistant, optional)** (the **Scan NSRP Form** screen).
2. Job seeker picks an image from the **Gallery** or takes one with the **Camera** (one page per image), then taps **Scan and Pre-fill**.
3. Backend runs OCR using Tesseract.js. When the PaddleOCR helper is set up (`npm run ocr:setup`, see `docs/OCR_SETUP.md`), it gives a second reading of each written answer box, and boxes where the two readings disagree are marked for the job seeker to check.
4. Parsed values are placed into editable review fields.
5. Job seeker checks and edits the fields.
6. Job seeker taps **Confirm and Save**.
7. Only then are values saved to the NSRP profile.

Rules:

- OCR never auto-saves.
- OCR output is always editable.
- OCR does not validate identity.
- OCR does not rank, screen, recommend, or decide.
- If OCR fails, the user can still manually encode the NSRP profile.

## Skill Comparison Workflow

Skill comparison is rule-based only.

1. Employer selects required skills in the job post.
2. Job seeker selects skills in the NSRP/profile screen.
3. The system compares skill IDs.
4. The system displays:
   - matched skills
   - missing required skills
   - counts

The comparison does not produce scores, rankings, recommendations, or automated hiring decisions.

## Notification Workflow

Notifications are stored in the database and shown in app notification screens.

Notification examples:

- Employer account created or approved.
- NSRP profile submitted, resubmitted, or changed after verification (PESO Admin).
- NSRP For Review / PESO-Verified / Needs Revision / sent back for re-checking (job seeker).
- New PESO-referred applicant (employer).
- New job posted by an approved employer; job post updated (applicants).
- Application status updated.
- Application closed because the job post was closed (job seeker; "not a rejection").
- Job post closed by PESO Admin (employer).
- Vacancies filled (waiting applicants) and all vacancies filled (employer); nobody's status changes.
- Account deactivated/reactivated.

These are in-app notification records, not native Android push notifications.

## Folder Structure

```text
pes-main/
  backend/
    routes/                  Express API routes
    services/                Shared backend services
    scripts/                 Utility scripts, including OCR smoke test
    tests/                   Backend regression tests
    db.js                    MySQL connection pool
    init-db.js               Creates schema from schema.sql
    schema.sql               MySQL tables and indexes
    seed.js                  Demo accounts and seed data
    server.js                Main Express server
  frontend/
    app/                     Expo Router screens by role
    src/api/                 Axios API client
    src/components/          Shared UI components
    src/constants/           Colors, spacing, status labels
    src/context/             Authentication context
  docs/
    PRD.md                   Product requirements and current behavior
    OBJECTIVE_TEST_CASES.md  Test cases per objective
    OCR_SETUP.md             Setting up the optional PaddleOCR second reader
  samples/
    nsrp-ocr/                Sample NSRP images for OCR demo and smoke testing
```

## Reference Materials And OCR Samples

The `samples/nsrp-ocr` folder contains the sample NSRP images kept in GitHub for OCR demo and testing: the two typed sample pages, a sideways copy of page 1 (`nsrp-page-1-sample-sideways.jpg`), and fictional development samples in `Digital/` (digitally filled forms) and `Handwritten/` (handwritten forms). The development samples were used while improving the OCR, so they are not used as final test results.

Use these files when demonstrating the OCR scan (**Scan NSRP Form**):

- `samples/nsrp-ocr/nsrp-page-1-sample.jpg`
- `samples/nsrp-ocr/nsrp-page-2-sample.jpg`

These images are used for:

- Demonstrating the OCR scan feature.
- Running the backend OCR smoke test.
- Giving group members a consistent test input.

The `figma-reference` folder can still be used locally for prototype exports, paper files, and PIT instruction files, but it is ignored by Git because those files are large and are not required for the app to run.

Recommended OCR demo flow using the samples:

1. Start the backend.
2. Start the frontend in Expo.
3. Log in as a new job seeker account (do not scan the sample into the seeded demo accounts).
4. Open **Profile**, then **Fill from a scanned NSRP form (OCR Assistant, optional)**.
5. Pick `samples/nsrp-ocr/nsrp-page-1-sample.jpg` and tap **Scan and Pre-fill**.
6. Review the extracted editable fields.
7. Scan `samples/nsrp-ocr/nsrp-page-2-sample.jpg` the same way to merge education, training, work experience, and skills.
8. Review/edit the combined fields.
9. Tap **Confirm and Save** only after checking the data.

## Prerequisites

Install these before running the project:

- Node.js LTS
- npm
- MySQL Server
- Expo Go app on Android phone, or Android Emulator
- Git, if cloning from a repository

Optional:

- Python with `pytest` and `requests`, only if running the Python backend regression tests.

## Download Or Copy The Project

### Option 1: From ZIP

1. Download the project ZIP.
2. Extract it.
3. Open the extracted folder:

```cmd
cd C:\Users\user\Downloads\pes-main\pes-main
```

### Option 2: From Git Repository

```cmd
git clone <repository-url>
cd pes-main
```

Use the folder that contains both `backend` and `frontend`.

## Backend Setup

Open Command Prompt or PowerShell in the project root.

```cmd
cd backend
npm install
```

Create or check `backend/.env`:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=peso_link_demo
PORT=8001
JWT_SECRET=replace_with_any_long_secret
JWT_EXPIRES_IN=7d
```

Create and seed a demo database (recommended):

```cmd
npm run reset-demo
```

This resets `peso_link_demo` only and seeds it. The backend uses it when `backend/.env` has `DB_NAME=peso_link_demo` (as above).

Warning: `node init-db.js` always targets `peso_link_misor` (the name is in `schema.sql`) and drops its tables. Use it only on a fresh setup where that database holds nothing you need; then set `DB_NAME=peso_link_misor` in `backend/.env` and run `node seed.js`.

Start the backend:

```cmd
npm start
```

Expected output:

```text
[Server] PESO-Link MisOr backend running on http://0.0.0.0:8001
[Server] Health: http://localhost:8001/api/health
[DB] Connected to MySQL database: peso_link_demo
```

(If the PaddleOCR helper is set up, a line about the second reader also appears.)

Health check:

```text
http://localhost:8001/api/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "PESO-Link MisOr Backend"
}
```

## Frontend Setup

Open a second terminal.

```cmd
cd frontend
npm install
```

### Android Emulator

If using Android Emulator, let the emulator reach the backend on your computer, then start Expo:

```cmd
adb reverse tcp:8001 tcp:8001
npm run android
```

(Inside the emulator, `localhost` is the emulator itself, so without `adb reverse` the app cannot reach the backend. Alternatively set `EXPO_PUBLIC_BACKEND_URL=http://10.0.2.2:8001` before starting Expo.)

### Physical Android Phone On Same Network

Find the laptop IP address:

```cmd
ipconfig
```

Look for the active IPv4 address, for example:

```text
192.168.18.71
```

Set the backend URL and Expo host before starting Expo:

```cmd
set REACT_NATIVE_PACKAGER_HOSTNAME=192.168.18.71
set EXPO_PUBLIC_BACKEND_URL=http://192.168.18.71:8001
npx.cmd expo start --lan -c
```

The QR code should show an Expo URL similar to:

```text
exp://192.168.18.71:8081
```

If it shows `127.0.0.1` or `localhost`, the phone will not connect.

### Tunnel Mode Fallback

If LAN mode fails because of Wi-Fi/router/firewall restrictions:

```cmd
set EXPO_PUBLIC_BACKEND_URL=http://192.168.18.71:8001
npx.cmd expo start --tunnel -c
```

Tunnel mode is slower but often works when LAN mode is blocked.

## Demo Accounts

These are created by `npm run reset-demo` (or `node seed.js`). They are for local demos only; the cloud server uses its own accounts.

| Role | Email | Password | Notes |
|---|---|---|---|
| PESO Admin | `admin@peso.gov.ph` | `Admin@123` | Main admin account |
| Job Seeker | `juan.cruz@example.com` | `Test@123` | NSRP submitted, waiting for PESO |
| Job Seeker | `maria.santos@example.com` | `Test@123` | PESO-verified, applied to IT Support Staff |
| Job Seeker | `pedro.reyes@example.com` | `Test@123` | NSRP needs revision |
| Job Seeker | `ana.bautista@example.com` | `Test@123` | PESO-verified, no applications yet |
| Employer | `hr@techcorp.ph` | `Test@123` | Approved employer |
| Employer | `hr@northstar.ph` | `Test@123` | Approved employer |

## Recommended Demo Flow

### 1. PESO Admin

1. Log in as `admin@peso.gov.ph`.
2. Show dashboard statistics.
3. Open employer management.
4. Show admin-created employer account flow.
5. Open job seeker management.
6. Open NSRP Verification, open Juan's submitted profile (becomes For Review), and Verify it.
7. Open monitor jobs and explain soft close.
8. Open monitor applications.

### 2. Job Seeker

1. Log in as a job seeker.
2. Open dashboard.
3. Open profile.
4. Show the PESO Verification card and required NSRP items checklist.
5. Show selected skills.
6. Open **Fill from a scanned NSRP form (OCR Assistant, optional)** from Profile.
7. Scan page 1 or page 2 sample if demonstrating OCR (use a new job seeker account for this).
8. Show editable OCR review fields.
9. Open jobs.
10. Search/filter jobs.
11. Open job details.
12. Show rule-based matched/missing skills.
13. Tap Apply with PESO Referral (needs a PESO-verified NSRP profile, and the skill minimum if it is turned on).
14. Open My Applications.
15. Open Notifications.

### 3. Employer

1. Log in as approved employer.
2. Open dashboard.
3. Open manage jobs.
4. Create or edit a job post.
5. Add requirements/application instructions.
6. Select required skills.
7. Open applicants.
8. Show that only PESO-referred applicants appear, with the PESO note.
9. Show applicant NSRP profile summary.
10. Show matched/missing skills.
11. Update application status.
12. Open notifications.

## Backend API Summary

Authentication:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

Job seeker:

- `GET /api/job-seeker/profile`
- `POST /api/job-seeker/profile`
- `POST /api/job-seeker/profile/submit-nsrp`
- `POST /api/job-seeker/skills`
- `DELETE /api/job-seeker/skills/:skillId`

NSRP OCR:

- `POST /api/nsrp/upload`
- `POST /api/nsrp/extract`
- `POST /api/nsrp/confirm`

Jobs:

- `GET /api/jobs`
- `GET /api/jobs/:id`
- `GET /api/jobs/:id/match`

Applications:

- `POST /api/applications` (apply with PESO referral; PESO-verified NSRP profile required)
- `GET /api/applications/my-applications`
- `GET /api/applications/:id`

Employer:

- `GET /api/employer/profile`
- `POST /api/employer/profile`
- `GET /api/employer/jobs`
- `POST /api/employer/jobs`
- `PUT /api/employer/jobs/:id`
- `PUT /api/employer/jobs/:id/close`
- `GET /api/employer/jobs/:id/applicants`
- `PUT /api/employer/applications/:id/status`

PESO Admin:

- `GET /api/admin/stats`
- `GET /api/admin/employers`
- `POST /api/admin/employers`
- `PUT /api/admin/employers/:id/approve`
- `PUT /api/admin/employers/:id/reject`
- `PUT /api/admin/employers/:id` (edit details)
- `PUT /api/admin/employers/:id/deactivate`
- `PUT /api/admin/employers/:id/reactivate`
- `GET /api/admin/job-seekers`
- `GET /api/admin/job-seekers/:id/profile`
- `GET /api/admin/job-seekers/:id/nsrp-forms` (uploaded NSRP form images)
- `PUT /api/admin/job-seekers/:id/nsrp-status`
- `PUT /api/admin/job-seekers/:id/deactivate`
- `PUT /api/admin/job-seekers/:id/reactivate`
- `GET /api/admin/jobs`
- `PUT /api/admin/jobs/:id/close`
- `GET /api/admin/applications`
- `GET /api/admin/applications/:id`

Shared:

- `GET /api/skills`
- `POST /api/skills`
- `GET /api/notifications`
- `PUT /api/notifications/:id/read`
- `PUT /api/notifications/read-all`

## Database Notes

Main tables:

- `users`
- `job_seekers`
- `employers`
- `peso_admins`
- `skills`
- `job_seeker_skills`
- `job_posts`
- `job_required_skills`
- `job_applications`
- `application_status_history`
- `notifications`
- `uploaded_nsrp_forms`

Important behavior:

- Job posts are soft-closed by setting `status='closed'`.
- Job applications are retained for tracking.
- OCR uploads require explicit confirmation before profile save.
- Employer accounts are controlled by PESO Admin.

## Verification Commands

Backend syntax:

```cmd
node -c backend\routes\nsrp.js
node -c backend\services\nsrpOcr.js
node -c backend\routes\jobSeeker.js
node -c backend\services\nsrpProfileValidation.js
node -c backend\routes\applications.js
node -c backend\routes\employer.js
```

OCR smoke:

```cmd
cd backend
npm.cmd run ocr:smoke -- ..\samples\nsrp-ocr\nsrp-page-1-sample.jpg
npm.cmd run ocr:smoke -- ..\samples\nsrp-ocr\nsrp-page-2-sample.jpg
```

Frontend lint and type check:

```cmd
cd frontend
npm.cmd run lint
npx.cmd tsc --noEmit
```

Backend live health check:

```cmd
curl http://localhost:8001/api/health
```

API end-to-end tests (backend running on the demo database; each file runs on a fresh seed):

```cmd
cd backend
npm run test:e2e
```

OCR check on the two typed sample NSRP pages (run from the `backend` folder; a regression check on that one sample, not a general accuracy rate): `node scripts/ocr-accuracy.js`.

Backend regression tests, if Python with pytest and requests is installed (a virtualenv is fine), on a freshly reset demo database:

```cmd
set PESO_LINK_BASE_URL=http://localhost:8001
python -m pytest backend\tests
```

## Troubleshooting

### Expo Go says it cannot connect

Check the Expo URL printed in the terminal.

Bad for physical phone:

```text
exp://127.0.0.1:8081
exp://localhost:8081
```

Good for physical phone:

```text
exp://192.168.x.x:8081
```

Fix:

```cmd
set REACT_NATIVE_PACKAGER_HOSTNAME=your_laptop_ip
set EXPO_PUBLIC_BACKEND_URL=http://your_laptop_ip:8001
npx.cmd expo start --lan -c
```

### Expo opens but login/API fails

The frontend is probably pointing to the wrong backend URL.

Set:

```cmd
set EXPO_PUBLIC_BACKEND_URL=http://your_laptop_ip:8001
```

Then restart Expo with cache clear:

```cmd
npx.cmd expo start --lan -c
```

### Backend cannot connect to MySQL

Check:

- MySQL service is running.
- `backend/.env` has correct DB credentials.
- Database exists.
- `npm run reset-demo` was run (or `node init-db.js` and `node seed.js` on a fresh setup).

### Port already in use

Find the process:

```cmd
netstat -ano | findstr :8081
netstat -ano | findstr :8001
```

Stop the process if it is a stale development server:

```cmd
taskkill /PID <PID> /F
```

## Final Defense Notes

Use these statements during demo:

- OCR is the emerging technology integration.
- OCR is assistive and user-confirmed.
- PESO verifies the NSRP profile once; the employer decides the application (For Interview, Hired).
- Skill comparison is rule-based matched/missing comparison only.
- PESO-Referred means the applicant's NSRP profile was verified by PESO; it is not a hiring decision.
- Job posts are soft-closed, not deleted.
- Notifications are in-app alerts.

## Out Of Scope

The app intentionally does not include:

- Automated applicant ranking.
- Automated hiring recommendations.
- AI screening.
- Chat or real-time messaging.
- Interview scheduling module.
- GPS tracking.
- Payment processing.
- Biometric login.
- External government database integration.
- Native push notification service.
