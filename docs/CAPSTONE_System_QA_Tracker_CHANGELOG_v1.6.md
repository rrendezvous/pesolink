# CAPSTONE System QA Tracker Changelog

## v1.6 - 2026-08-07

File: `CAPSTONE_System_QA_Tracker_PESO-Link_v1.6.xlsx`

Final conservative tracker update before submission review. This version removes the last `Ready to Deploy` row so the tracker does not overclaim readiness while live MySQL/API validation, end-to-end testing, NSRP/OCR validation, and V11.49 workflow alignment are still pending.

### Changed

- Updated the tracker status summary to:
  - `Ready to Deploy`: 0
  - `Under Development`: 34
  - `Not Yet Implemented`: 2
- Changed Row 1 from `Ready to Deploy` to `Under Development`.
- Renamed Row 1 to `Android frontend TypeScript/lint readiness pending full deployment validation`.
- Kept Row 31 as `Not Yet Implemented`.
- Kept Row 33 as `Not Yet Implemented`.

### Why

- Although TypeScript and Expo lint checks passed, Row 1 is only a code-quality/readiness check.
- The application is not fully deployment-ready because live MySQL/API validation is blocked, end-to-end testing is still pending, and the V11.49 referral/application workflow still needs alignment.
- The tracker intentionally has no `Ready to Deploy` rows until deployment preparation can be validated with the backend, database, and capstone-aligned workflows.

### Verification

- `v1.6` was generated from the Excel-verified `v1.5` workbook using the safer cell-level patch method.
- XLSX package opened successfully through Microsoft Excel in hidden read-only mode.
- Excel read Row 1 as `Under Development` and Rows 31 and 33 as `Not Yet Implemented`.
- Tracker row readback confirmed:
  - `Ready to Deploy`: 0
  - `Under Development`: 34
  - `Not Yet Implemented`: 2

## v1.5 - 2026-08-07

File: `CAPSTONE_System_QA_Tracker_PESO-Link_v1.5.xlsx`

More conservative QA update using a stricter definition of deployment readiness. This version avoids marking dynamic, database-backed, referral-dependent, or still-unvalidated features as ready based only on existing screens or routes.

### Ready to Deploy Standard

- `Ready to Deploy` means implemented, paper-aligned, and validated enough for demo/deployment preparation.
- `Under Development` includes implemented but not fully tested, blocked by database/API setup, not yet aligned with V11.49, or still needing wording/workflow cleanup.

### Changed

- Updated the tracker status summary to:
  - `Ready to Deploy`: 1
  - `Under Development`: 33
  - `Not Yet Implemented`: 2
- Changed Row 15 to `Under Development`.
- Renamed Row 15 to `Job details, employer details, and application instructions pending application/referral wording cleanup`.
- Changed Row 16 to `Under Development`.
- Renamed Row 16 to `Rule-based matched/missing skill comparison pending end-to-end validation`.
- Changed Rows 7, 9, 12, 13, 18, 20, 21, 22, 26, 27, 28, and 29 from `Ready to Deploy` to `Under Development`.
- Kept Row 1 as `Ready to Deploy` because frontend TypeScript and Expo lint checks were run successfully and do not depend on the blocked live MySQL/API configuration.
- Kept Rows 31 and 33 as `Not Yet Implemented`.

### Why

- Row 15 exists in the app, but the same job details screen still includes the current `Submit Application` flow and "sent to employer" wording, which still needs cleanup to match V11.49's distinction between external employer-provided application instructions and PESO-Link referral requests.
- Row 16 is conceptually aligned and implemented, but it has not been validated end-to-end with live MySQL/API, seeded or real job seeker skills, employer-required skills, and confirmed NSRP profile skills.
- Rows 7, 9, 12, 13, 18, 20, 21, 22, 26, 27, 28, and 29 are implemented or partially implemented, but they are database/API-backed and were not live-tested because MySQL is still returning `ECONNREFUSED`.
- Several of those rows also touch the application/referral tracking flow, which still needs V11.49 alignment around job-specific PESO referral requests and `PESO-Referred` handling.
- The tracker is intentionally conservative: if readiness evidence is incomplete, the row is marked `Under Development`.

### Verification

- `v1.5` was generated from the Excel-verified `v1.4` workbook using the safer cell-level patch method.
- XLSX package opened successfully through Microsoft Excel in hidden read-only mode.
- Excel read Row 15 and Row 16 correctly as `Under Development`.
- Frontend TypeScript check passed.
- Expo lint passed with warnings only.
- Live MySQL/database check still returned `ECONNREFUSED`.
- Tracker row readback confirmed:
  - `Ready to Deploy`: 1
  - `Under Development`: 33
  - `Not Yet Implemented`: 2

## v1.4 - 2026-08-07

File: `CAPSTONE_System_QA_Tracker_PESO-Link_v1.4.xlsx`

QA-conservative update after reviewing whether NSRP and OCR should be considered deployment-ready. The tracker now treats NSRP field completeness and OCR real-form validation as still pending, even though the related screens and backend flows already exist.

### Changed

- Updated the tracker status summary to:
  - `Ready to Deploy`: 15
  - `Under Development`: 19
  - `Not Yet Implemented`: 2
- Changed Row 8 from `Ready to Deploy` to `Under Development`.
- Renamed Row 8 to `NSRP-based profile creation/editing pending official NSRP field-completeness validation`.
- Changed Row 10 from `Ready to Deploy` to `Under Development`.
- Renamed Row 10 to `OCR-assisted NSRP image upload or camera capture pending live-device/API validation`.
- Changed Row 11 from `Ready to Deploy` to `Under Development`.
- Renamed Row 11 to `OCR extraction review, manual editing, and confirmed save pending real-form OCR validation`.
- Kept Row 9 as `Ready to Deploy` because skills selection and saved skill persistence are separate from NSRP field-completeness and OCR validation risk.

### Why

- The NSRP profile module exists, but official field-by-field completeness still needs to be confirmed against the actual NSRP source form used for the capstone paper.
- The OCR upload/camera flow exists, but it still needs broader live-device and live API validation.
- The OCR review/edit/confirm flow exists, but OCR has only been smoke-tested using sample NSRP images and should not be called deployment-ready until tested with actual captured/accomplished NSRP forms.

### Verification

- `v1.4` was generated from the Excel-verified `v1.3` workbook using the safer cell-level patch method.
- Tracker row readback confirmed:
  - `Ready to Deploy`: 15
  - `Under Development`: 19
  - `Not Yet Implemented`: 2

## v1.3 - 2026-08-07

File: `CAPSTONE_System_QA_Tracker_PESO-Link_v1.3.xlsx`

Rebuilt the stricter tracker as an Excel-safe workbook after `v1.2` triggered Microsoft Excel recovery and opened empty.

### Changed

- Created `v1.3` from the last stable workbook structure instead of reusing the corrupted `v1.2` package.
- Preserved the same stricter tracker content from `v1.2`:
  - `Ready to Deploy`: 18
  - `Under Development`: 16
  - `Not Yet Implemented`: 2
- Reapplied the same capstone-alignment row updates from `v1.2`, including the downgrades for backend/MySQL readiness, job-specific referral alignment, `PESO-Referred` status alignment, employer applicant visibility, employer status updates, admin application processing, and live API testing.

### Why

- `v1.2` was not Excel-safe because the spreadsheet XML rewrite changed namespace prefixes in a way that caused Microsoft Excel to recover the workbook incorrectly.
- `v1.3` was rebuilt with a cell-level patch that preserves the original Excel worksheet XML structure.

### Verification

- XLSX package opened successfully through Microsoft Excel in hidden read-only mode.
- Excel read worksheet data correctly, including Row 2 as `Under Development`.
- All workbook XML files parsed successfully.
- Tracker row readback confirmed:
  - `Ready to Deploy`: 18
  - `Under Development`: 16
  - `Not Yet Implemented`: 2

## v1.2 - 2026-08-07

File: `CAPSTONE_System_QA_Tracker_PESO-Link_v1.2.xlsx`

Updated after a stricter no-bias re-audit against the current code, the V11.49 capstone paper, the compliance matrix, and the attached review notes. The README was still not treated as authoritative.

### Status Rule Used

- `Ready to Deploy`: implemented in code and aligned with the current V11.49 capstone scope.
- `Under Development`: code exists but is incomplete, untested at live API level, blocked by configuration/database readiness, or not fully aligned with the paper yet.
- `Not Yet Implemented`: target paper/compliance feature is absent from the current code.

### Changed

- Updated the stricter tracker status summary to:
  - `Ready to Deploy`: 18
  - `Under Development`: 16
  - `Not Yet Implemented`: 2
- Changed Row 2 to `Under Development` and renamed it to `Backend API source syntax and route loading pending live MySQL validation` because backend source syntax passes, but live database-backed API validation is blocked by MySQL `ECONNREFUSED`.
- Changed Row 3 to `Under Development` and renamed it to `MySQL schema, seed data, and live database readiness` because schema, seed, and migration files exist, but the configured live MySQL connection is not currently accepting connections.
- Renamed Row 8 to `NSRP-based profile creation/editing` while keeping it `Ready to Deploy` because the profile module itself is implemented, while PESO Admin review controls are tracked separately in Row 30.
- Changed Row 17 to `Under Development` and renamed it to `Application submission flow pending job-specific PESO referral alignment` because the current code uses profile-level `referral_ready` gating before application submission, while the V11.49 paper describes selected-job PESO referral requests and routing.
- Changed Row 19 to `Under Development` and renamed it to `My Applications status tracking pending PESO-Referred alignment` because the screen exists, but the application status system still lacks the paper-required `PESO-Referred` status.
- Renamed Row 21 to `Login through PESO Admin-created employer account` while keeping it `Ready to Deploy` to avoid implying unsupported employer self-registration as a final proposal workflow.
- Changed Row 23 to `Under Development` because close-posting code exists, but deployment-level confidence is still limited by the blocked live MySQL/API regression check.
- Changed Row 24 to `Under Development` and renamed it to `View applicants with NSRP summary pending PESO-Referred endorsement alignment` because employers can view applicants and skill comparison, but the final paper workflow expects PESO-endorsed or PESO-Referred applicant visibility.
- Changed Row 25 to `Under Development` and renamed it to `Update current application tracking status pending PESO-Referred alignment` because employer status updates exist, but the allowed status set still includes `pending` and does not include `PESO-Referred`.
- Changed Row 32 to `Under Development` and renamed it to `PESO Admin application monitoring pending referral processing controls` because the current admin application screen is read-only, while V11.49 requires PESO Admin referral review, routing, and status processing.
- Renamed Row 35 to `Legacy employer approval/rejection workflow cleanup` while keeping it `Under Development` because backend approval/rejection routes and a hidden approval screen remain, but the safer proposal direction is PESO Admin-created and managed employer accounts.
- Kept Row 31 as `Not Yet Implemented` because a job-specific PESO referral routing and endorsement workflow is not present in the current schema, routes, or screens.
- Kept Row 33 as `Not Yet Implemented` because `PESO-Referred` is absent from the current application status enum, backend update flow, and frontend status labels.

### Verification

- Frontend TypeScript check passed.
- Expo lint passed with warnings only.
- Backend project-source JavaScript syntax check passed, excluding `node_modules`.
- OCR smoke test passed on `samples/nsrp-ocr/nsrp-page-1-sample.jpg`.
- OCR smoke test passed on `samples/nsrp-ocr/nsrp-page-2-sample.jpg`.
- Python regression tests were not run because `pytest` is not installed.
- Live API/database validation was not completed because the configured MySQL connection returned `ECONNREFUSED`.

## v1.1 - 2026-08-07

File: `CAPSTONE_System_QA_Tracker_PESO-Link_v1.1.xlsx`

Updated after a source-code-only audit of the current PESO-Link MisOr project. The README was not treated as authoritative because it has not been updated yet. The capstone paper and compliance matrix were used only as target-scope references.

### Changed

- Renamed the tracker from `v1` to `v1.1`.
- Updated the tracker status summary to:
  - `Ready to Deploy`: 26
  - `Under Development`: 8
  - `Not Yet Implemented`: 2
- Marked implemented role flows as `Ready to Deploy` when code exists in both frontend and backend or the source implementation is complete enough to test.
- Kept `Location filtering in the Job Seeker interface` as `Under Development` because the backend accepts a `location` query parameter but the job seeker job-browse UI does not expose a location filter field.
- Kept `Suspended-account login blocking and active-session enforcement` as `Under Development` because suspended users are blocked during login, but existing JWT sessions are not revalidated against `account_status`.
- Kept `NSRP profile review UI and Referral-Ready/Needs Revision controls` as `Under Development` because admin status controls exist, but there is no full NSRP detail review screen yet.
- Kept `Pending employer approval/rejection UI navigation and full account management` as `Under Development` because backend approval routes and a hidden approval screen exist, but the current admin tab/navigation does not expose the pending approval workflow as a normal screen.
- Kept `Application submitted/pending status history consistency` as `Under Development` because new applications are inserted as `submitted`, while the first status-history record stores `pending`.
- Kept `Job-specific PESO referral routing and endorsement workflow` as `Not Yet Implemented` because the current code implements profile-level referral readiness and application tracking, not a separate job-specific PESO routing/endorsement process.
- Kept `PESO-Referred per-application status/label handling` as `Not Yet Implemented` because `PESO-Referred` is not in the current application status enum, frontend status labels, or backend status update flow.
- Kept `Live MySQL/API regression testing with seeded three roles` as `Under Development` because the configured MySQL connection returned `ECONNREFUSED` during audit.

### Verification

- Backend JavaScript syntax check passed.
- Frontend TypeScript check passed.
- Expo lint passed with warnings only.
- OCR smoke test passed on `samples/nsrp-ocr/nsrp-page-1-sample.jpg`.
- OCR smoke test passed on `samples/nsrp-ocr/nsrp-page-2-sample.jpg`.
- Python regression tests were not run because `pytest` is not installed.
- Live API regression was not completed because MySQL was not accepting connections on the configured `localhost:3306`.
