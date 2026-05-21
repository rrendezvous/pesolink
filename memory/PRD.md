# PESO-Link MisOr — Product Requirements (PRD)

## Project Title
**PESO-Link MisOr: A Mobile-Based Employment Registration and Validation Support System for PESO Misamis Oriental**

IT323 Applications Development and Emerging Technology — Final Project.

## Tech Stack
- **Frontend**: React Native + Expo (TypeScript), Android-focused demo
- **Backend**: Node.js + Express (REST/JSON)
- **Database**: MySQL / MariaDB
- **Auth**: JWT (bcryptjs password hashing)
- **OCR**: tesseract.js (real, optional, assistive, user-confirmed; manual fallback if OCR fails)

## Roles
- **Job Seeker** — self-registration allowed. Builds NSRP profile, optionally uses OCR, applies to jobs.
- **Employer** — accounts are **created by PESO Admin only**. Employer self-registration is disabled.
- **PESO Admin** — manages employer + job seeker accounts, monitors jobs/applications, closes jobs (soft removal).

## Account Status (`users.account_status`)
`active` | `pending` | `suspended`

## Application Statuses (tracking only — not hiring decisions)
- `submitted` (default on apply) — sent by job seeker
- `pending` — received, not yet reviewed
- `for_review` — being reviewed
- `referred` — routed for employer consideration
- `rejected` — no longer being considered
- `closed` — application/job process closed

## Job Post Status
`active` | `closed` | `draft`
- Admin "remove" action = **soft close** (`closed`); records retained for monitoring/audit.

## OCR Behaviour
- Engine: tesseract.js running on the backend (`POST /api/nsrp/extract`).
- Extracts **raw text** from uploaded NSRP image and parses into editable fields with simple regex.
- Returns `{ success, extracted_data, raw_text, notice, error_message? }`.
- **Never auto-saves.** User must review, edit, and confirm via `POST /api/nsrp/confirm`.
- On OCR failure / empty result: 200 OK with empty editable scaffold + clear notice → user encodes manually.
- OCR does **not** validate identity, rank, screen, recommend, or decide.

## Skill Matching
- Rule-based set comparison only.
- Returns `matched_skills` + `unmatched_required_skills` + counts.
- No ranking, no recommendation, no automated screening.

## Strict Exclusions (out of scope)
chat, GPS, interview scheduling, payment, biometric login, external government DB integration, AI screening, applicant ranking, hiring recommendation, resume-based application system, automated hiring decisions.

## Demo Accounts (seeded)
| Role | Email | Password | Notes |
|---|---|---|---|
| Admin | admin@peso.gov.ph | Admin@123 | |
| Seeker | juan.cruz@example.com | Test@123 | IT, profile complete |
| Seeker | maria.santos@example.com | Test@123 | Has `for_review` application |
| Seeker | pedro.reyes@example.com | Test@123 | Electrical/Trade |
| Employer | hr@techcorp.ph | Test@123 | Approved (2 jobs) |
| Employer | hr@northstar.ph | Test@123 | Approved (2 jobs) |
| Employer | hr@bluemountain.ph | Test@123 | Legacy pending (employer self-reg disabled going forward) |

## Local Setup
```bash
# 1. MySQL
mysql -u root -p
> CREATE DATABASE peso_link_misor;
> CREATE USER 'peso'@'localhost' IDENTIFIED BY 'pesopass123';
> GRANT ALL ON peso_link_misor.* TO 'peso'@'localhost';

# 2. Backend
cd /app/backend
npm install
node init-db.js
node seed.js
npm start         # :8001

# 3. Frontend (Expo, Android emulator)
cd /app/frontend
yarn install
npx expo start --android
```

## API Routes (highlights of new/changed)
- `POST /api/auth/register` — **job_seeker only**; employer attempts return 400.
- `POST /api/admin/employers` — admin creates employer (auto-approved).
- `PUT /api/admin/job-seekers/:id/deactivate` / `/reactivate` — admin manages seeker account_status.
- `PUT /api/admin/jobs/:id/close` — soft-close (status='closed'), record retained.
- `POST /api/nsrp/extract` — real OCR via tesseract.js with fallback notice on failure.
- Application status flow uses 6 values listed above. Default = `submitted`.
