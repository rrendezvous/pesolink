# PESO-Link MisOr Product Requirements

## Project Title

**PESO-Link MisOr: A Mobile-Based Employment Registration and Validation Support System for PESO Misamis Oriental**

Course: IT323 Applications Development and Emerging Technology  
Phase: Finalization for PIT/demo

## Product Summary

PESO-Link MisOr is an Android-focused mobile employment facilitation prototype for PESO Misamis Oriental. It provides role-based access for job seekers, employers, and PESO Admin users. The system supports NSRP-based job seeker profiles, optional OCR-assisted NSRP form prefill, localized job browsing, employer job posting, application tracking, in-app notifications, admin monitoring, and rule-based skill comparison.

The app is designed to complement PESO workflows. It does not replace official PESO validation, NSRP processing, PEIS/PhilJobNet encoding, employer evaluation, or hiring decisions.

## Technology Stack

- Frontend: React Native Expo with TypeScript
- Backend: Node.js Express REST API
- Database: MySQL
- Authentication: JWT and bcryptjs password hashing
- OCR: Tesseract.js on the backend
- Target demo platform: Android through Expo Go or Android Emulator

## User Roles

### Job Seeker

Job seekers can self-register, complete an NSRP-based profile, optionally use OCR to prefill editable fields, submit the profile for PESO review, browse jobs, compare skills, apply to jobs after profile readiness review, track applications, and view notifications.

### Employer

Employers use accounts created or controlled by PESO Admin. Approved employers can create and update job postings, select required skills, provide requirements/application instructions, view applicants, see applicant NSRP profile summaries, see matched/missing skills, and update application tracking statuses.

### PESO Admin

PESO Admin users manage employer accounts, monitor job seekers, review NSRP profile readiness, manage referral-ready status, monitor job postings, soft-close posts, and monitor application records.

## Core Requirements

### Authentication And Access Control

- The system shall allow job seekers to register.
- The system shall allow job seekers, employers, and PESO Admin users to log in.
- The system shall block employer self-registration.
- The system shall allow PESO Admin to create employer accounts.
- The system shall restrict backend routes by user role.
- The system shall prevent suspended users from logging in.

### NSRP Profile Management

- The system shall allow job seekers to create and update an NSRP-based profile.
- The system shall store core profile fields and extended NSRP data.
- The system shall allow job seekers to encode skills.
- The system shall show a checklist of required PESO review fields.
- The system shall block PESO review submission when required profile fields are incomplete.

### OCR-Assisted NSRP Prefill

- The system shall allow job seekers to upload or scan NSRP form images.
- The system shall support page 1 and page 2 NSRP OCR extraction.
- The system shall parse OCR output into editable fields.
- The system shall allow page 2 OCR data to merge into the same editable review form.
- The system shall require job seeker confirmation before saving OCR-filled data.
- The system shall provide manual encoding fallback when OCR fails.
- The system shall never auto-save OCR data.
- The system shall not use OCR to validate identity, screen applicants, rank applicants, recommend applicants, or make decisions.

### PESO Profile Review Track

- The system shall allow job seekers to submit a complete NSRP profile for PESO review.
- The system shall allow PESO Admin to mark the profile as `referral_ready` or `needs_revision`.
- The system shall notify job seekers when PESO review status changes.
- The system shall keep profile review separate from employer application tracking.

Profile review statuses:

- `draft`
- `submitted`
- `needs_revision`
- `referral_ready`

### Job Posting Management

- The system shall allow approved employers to create job postings.
- The system shall allow approved employers to update job postings.
- The system shall allow employers to provide requirements/application instructions.
- The system shall allow employers to select required skills for each job.
- The system shall allow employers and PESO Admin to close job posts.
- The system shall retain closed job posts for monitoring instead of hard-deleting them.
- The system shall notify active job seekers when a new job is posted by an approved employer.

Job post statuses:

- `active`
- `closed`
- `draft`

### Job Browsing And Job Details

- The system shall allow job seekers to browse active job postings.
- The system shall allow job seekers to search jobs by title, description, or employer name.
- The system shall allow filtering by job type.
- The system shall display job details, employer details, requirements/application instructions, salary range when available, location, job type, vacancies, and closing date.
- The system shall display rule-based skill comparison for job seekers.

### Rule-Based Skill Comparison

- The system shall compare confirmed job seeker skills with employer-required job skills.
- The system shall display matched skills.
- The system shall display missing required skills.
- The system shall display counts only as a simple comparison.
- The system shall not generate scores, rankings, recommendations, automated screening results, or hiring decisions.

### Job Application Tracking

- The system shall allow only PESO Referral-Ready job seekers to submit applications.
- The system shall prevent duplicate applications to the same job.
- The system shall allow job seekers to view submitted applications.
- The system shall allow employers to view applicants for their own job posts.
- The system shall allow employers to update application status.
- The system shall notify job seekers when application status changes.
- The system shall allow PESO Admin to monitor application records.

Application tracking statuses:

- `submitted`
- `pending`
- `for_review`
- `for_interview`
- `hired`
- `rejected`
- `closed`

These statuses are manually updated tracking labels and do not represent automated system decisions.

### Employer Applicant View

The employer applicant view shall show:

- Applicant name
- Email
- Contact number
- City/province
- Education level and course
- Years of experience
- Employment status
- Preferred occupation
- PESO profile review status
- Matched skills
- Missing required skills
- Applicant encoded skills
- Cover letter when submitted
- Application status update controls

### Notifications

The system shall store and display in-app notification records for:

- Employer account creation
- Employer account approval/rejection
- NSRP profile review updates
- New job posting alerts to active seekers
- New application alerts to employers
- Application status updates to seekers
- Admin job closure alerts
- Account deactivation/reactivation

Native push notification service is not part of the current prototype.

## Main Backend Modules

- `backend/server.js`: Express app entry point
- `backend/db.js`: MySQL connection pool
- `backend/schema.sql`: database schema
- `backend/init-db.js`: schema initialization
- `backend/seed.js`: seed data
- `backend/routes/auth.js`: authentication
- `backend/routes/jobSeeker.js`: profile, skills, PESO review submission
- `backend/routes/nsrp.js`: OCR upload, extraction, confirmation
- `backend/routes/jobs.js`: job browsing, details, skill comparison
- `backend/routes/applications.js`: job seeker applications
- `backend/routes/employer.js`: employer profile, jobs, applicants, status updates
- `backend/routes/admin.js`: PESO Admin management and monitoring
- `backend/routes/misc.js`: skills and notifications
- `backend/services/nsrpOcr.js`: OCR extraction and parsing
- `backend/services/nsrpProfileValidation.js`: PESO review requirements

## Main Frontend Modules

- `frontend/app/index.tsx`: role-aware landing/redirect
- `frontend/app/login.tsx`: login
- `frontend/app/register.tsx`: job seeker registration
- `frontend/app/(seeker)/dashboard.tsx`: seeker dashboard
- `frontend/app/(seeker)/profile.tsx`: NSRP profile and PESO review submission
- `frontend/app/(seeker)/upload-nsrp.tsx`: OCR-assisted NSRP review and save
- `frontend/app/(seeker)/jobs.tsx`: job browsing/search/filtering
- `frontend/app/(seeker)/job/[id].tsx`: job details, application, skill comparison
- `frontend/app/(seeker)/my-applications.tsx`: seeker application tracking
- `frontend/app/(seeker)/notifications.tsx`: seeker notifications
- `frontend/app/(employer)/dashboard.tsx`: employer dashboard
- `frontend/app/(employer)/manage-jobs.tsx`: employer job list and close action
- `frontend/app/(employer)/job-form.tsx`: create/update job post
- `frontend/app/(employer)/applicants.tsx`: applicant review and status updates
- `frontend/app/(employer)/notifications.tsx`: employer notifications
- `frontend/app/(admin)/dashboard.tsx`: admin dashboard
- `frontend/app/(admin)/manage-employers.tsx`: employer account management
- `frontend/app/(admin)/manage-job-seekers.tsx`: job seeker account/profile review
- `frontend/app/(admin)/monitor-jobs.tsx`: job post monitoring
- `frontend/app/(admin)/monitor-apps.tsx`: application monitoring
- `frontend/src/api/client.ts`: Axios API client
- `frontend/src/context/AuthContext.tsx`: authentication state
- `frontend/src/components/ui.tsx`: shared UI components
- `frontend/src/constants/theme.ts`: colors, spacing, status labels

## Demo Accounts

| Role | Email | Password | Notes |
|---|---|---|---|
| PESO Admin | `admin@peso.gov.ph` | `Admin@123` | Main admin account |
| Job Seeker | `juan.cruz@example.com` | `Test@123` | Complete seeker profile |
| Job Seeker | `maria.santos@example.com` | `Test@123` | Existing application data |
| Job Seeker | `pedro.reyes@example.com` | `Test@123` | Trade/electrical profile |
| Employer | `hr@techcorp.ph` | `Test@123` | Approved employer |
| Employer | `hr@northstar.ph` | `Test@123` | Approved employer |
| Employer | `hr@bluemountain.ph` | `Test@123` | Pending employer account |

## Verification Checklist

- Backend syntax checks pass.
- OCR smoke test passes for `samples/nsrp-ocr/nsrp-page-1-sample.jpg` and `samples/nsrp-ocr/nsrp-page-2-sample.jpg`.
- Frontend lint passes with no errors.
- TypeScript check passes.
- Backend health endpoint returns `ok`.
- Seeded users can log in.
- Job browsing returns active jobs.
- Job details and skill comparison return valid data.
- Employer applicant endpoint returns matched/missing skill fields.
- Admin monitoring endpoints return data.

## Known Prototype Limitations

- Android is the official target. iOS/web previews are not submitted deployment targets.
- Notifications are in-app records, not native push notifications.
- PESO profile readiness is reviewed at profile level, while job applications are tracked separately.
- OCR accuracy depends on image quality and NSRP form layout.
- The system does not connect to PEIS, PhilJobNet, or other external government databases.
- The system does not include chat, payment, GPS tracking, biometric login, interview scheduling, automated screening, ranking, or recommendations.
