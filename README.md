# PESO-Link MisOr

PESO-Link MisOr is an Android-focused mobile employment facilitation system for PESO Misamis Oriental. It is a BSIT capstone prototype built with React Native Expo, Node.js Express, and MySQL.

The app centralizes job seeker registration, NSRP-based profile encoding, optional OCR-assisted NSRP form prefill, employer job posting, job browsing, application tracking, notifications, and PESO admin monitoring.

## Project Scope

The submitted system is:

- Android-focused mobile app using Expo React Native.
- REST API backend using Node.js, Express, JWT authentication, and MySQL.
- Local or LAN-demo runnable prototype for PIT/demo.
- OCR-assisted NSRP encoding using Tesseract.js as the emerging technology.

The submitted system is not:

- A replacement for official PESO, PEIS, PhilJobNet, or NSRP processing.
- A hiring decision system.
- An AI screening, ranking, or recommendation system.
- A chat, payment, GPS, biometric login, interview scheduling, or external government database integration system.

## Main Features

### Job Seeker

- Register and log in.
- Create and update an NSRP-based job seeker profile.
- Optionally scan NSRP form page 1 and page 2 using OCR.
- Review and edit all OCR-filled fields before saving.
- Save selected skills for rule-based job comparison.
- View PESO Review Requirements before submitting the profile.
- Submit completed NSRP profile for PESO admin review.
- Browse active job postings.
- Search and filter jobs by keyword and job type.
- View job details, requirements, application instructions, employer details, and skill comparison.
- Submit an application only after the NSRP profile is marked PESO Referral-Ready.
- Track submitted applications.
- View notifications.

### Employer

- Log in using a PESO Admin-created or approved employer account.
- View employer dashboard and notifications.
- Create job postings.
- Update job postings.
- Encode requirements/application instructions.
- Select required skills for rule-based comparison.
- Soft-close job postings while keeping records for monitoring.
- View applicants for own job postings.
- View applicant NSRP profile summary, contact information, PESO review status, matched skills, missing required skills, and application status.
- Manually update application tracking status.

### PESO Admin

- Log in using admin credentials.
- View dashboard statistics.
- Create employer accounts.
- Approve or reject employer accounts when applicable.
- View and manage employer accounts.
- View job seeker accounts.
- Deactivate/reactivate job seeker accounts.
- Review job seeker NSRP profile readiness.
- Mark profiles as PESO Referral-Ready or Needs Revision.
- Monitor job postings.
- Soft-close job postings.
- Monitor application records.
- View system notifications through the affected user accounts.

## Important Workflow Explanation

The app uses a two-track model:

1. **NSRP Profile Review Track**
   - The job seeker completes an NSRP-based profile.
   - The job seeker submits the profile for PESO review.
   - PESO Admin reviews the profile and marks it as:
     - `draft`
     - `submitted`
     - `needs_revision`
     - `referral_ready`
   - `referral_ready` means the NSRP profile was reviewed for employment facilitation support. It is not a hiring decision.

2. **Job Application Tracking Track**
   - After the profile is `referral_ready`, the job seeker can apply to job postings.
   - Employers can review applicants and update the application tracking status.
   - Application statuses are:
     - `submitted`
     - `pending`
     - `for_review`
     - `for_interview`
     - `hired`
     - `rejected`
     - `closed`
   - These statuses are manually updated for tracking. They are not automated decisions.

This keeps PESO profile readiness separate from employer application outcomes.

## OCR Workflow

OCR is optional and assistive only.

1. Job seeker opens **Upload NSRP**.
2. Job seeker selects or captures an NSRP form image.
3. Backend runs OCR using Tesseract.js.
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
- NSRP profile marked referral-ready or needs revision.
- New job posted by an approved employer.
- New application received by employer.
- Application status updated.
- Job post soft-closed by PESO Admin.
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
    PAPER_ALIGNMENT_NOTES.md Paper/defense wording notes
  samples/
    nsrp-ocr/                Sample NSRP images for OCR demo and smoke testing
```

## Reference Materials And OCR Samples

The `samples/nsrp-ocr` folder contains the two NSRP images that should be kept in GitHub for OCR demo and testing.

Use these files when demonstrating **Upload NSRP Form (OCR)**:

- `samples/nsrp-ocr/nsrp-page-1-sample.jpg`
- `samples/nsrp-ocr/nsrp-page-2-sample.jpg`

These images are used for:

- Demonstrating the Upload NSRP OCR feature.
- Running the backend OCR smoke test.
- Giving group members a consistent test input.

The `figma-reference` folder can still be used locally for prototype exports, paper files, and PIT instruction files, but it is ignored by Git because those files are large and are not required for the app to run.

Recommended OCR demo flow using the samples:

1. Start the backend.
2. Start the frontend in Expo.
3. Log in as a job seeker.
4. Open **Upload NSRP Form (OCR)**.
5. Upload `samples/nsrp-ocr/nsrp-page-1-sample.jpg`.
6. Review the extracted editable fields.
7. Upload `samples/nsrp-ocr/nsrp-page-2-sample.jpg` to merge education, training, work experience, and skills.
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

- Python and pytest, only if running the Python backend regression tests.

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
DB_NAME=peso_link_misor
PORT=8001
JWT_SECRET=replace_with_any_long_secret
JWT_EXPIRES_IN=7d
```

Initialize and seed the database:

```cmd
node init-db.js
node seed.js
```

Start the backend:

```cmd
npm start
```

Expected output:

```text
[DB] Connected to MySQL database: peso_link_misor
[Server] PESO-Link MisOr backend running on http://0.0.0.0:8001
```

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

If using Android Emulator, start Expo:

```cmd
npm run android
```

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

These are created by `node seed.js`.

| Role | Email | Password | Notes |
|---|---|---|---|
| PESO Admin | `admin@peso.gov.ph` | `Admin@123` | Main admin account |
| Job Seeker | `juan.cruz@example.com` | `Test@123` | Complete seeker profile |
| Job Seeker | `maria.santos@example.com` | `Test@123` | Existing application data |
| Job Seeker | `pedro.reyes@example.com` | `Test@123` | Trade/electrical profile |
| Employer | `hr@techcorp.ph` | `Test@123` | Approved employer |
| Employer | `hr@northstar.ph` | `Test@123` | Approved employer |
| Employer | `hr@bluemountain.ph` | `Test@123` | Pending employer account |

## Recommended Demo Flow

### 1. PESO Admin

1. Log in as `admin@peso.gov.ph`.
2. Show dashboard statistics.
3. Open employer management.
4. Show admin-created employer account flow.
5. Open job seeker management.
6. Show NSRP profile referral status controls.
7. Open monitor jobs and explain soft close.
8. Open monitor applications.

### 2. Job Seeker

1. Log in as a job seeker.
2. Open dashboard.
3. Open profile.
4. Show PESO Review Requirements checklist.
5. Show selected skills.
6. Open Upload NSRP.
7. Scan page 1 or page 2 sample if demonstrating OCR.
8. Show editable OCR review fields.
9. Open jobs.
10. Search/filter jobs.
11. Open job details.
12. Show rule-based matched/missing skills.
13. Submit application if account is referral-ready.
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
8. Show applicant NSRP profile summary.
9. Show PESO Referral-Ready label.
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
- `POST /api/job-seeker/profile/submit-referral`
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

- `POST /api/applications`
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
- `GET /api/admin/job-seekers`
- `PUT /api/admin/job-seekers/:id/deactivate`
- `PUT /api/admin/job-seekers/:id/reactivate`
- `PUT /api/admin/job-seekers/:id/referral-status`
- `GET /api/admin/jobs`
- `PUT /api/admin/jobs/:id/close`
- `GET /api/admin/applications`

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

Backend regression tests, if Python and pytest are installed:

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
- `node init-db.js` and `node seed.js` were run.

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
- NSRP profile review is separate from employer application tracking.
- Skill comparison is rule-based matched/missing comparison only.
- PESO Referral-Ready is not a hiring decision.
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
