# QA Tracker: Proposed Updates (PESO-Link sheet)

- **Based on:** `docs/QA Tracker Upd - Oct 4 2026.xlsm`, sheet "PESO-Link", rows 11-53 (row numbers below are the tracker's "No." column).
- **The tracker file was not edited.** These are proposals for the team. The adviser sets the **Status** column.
- **Evidence** is developer testing on 2026-10-04 on the demo database: API tests, pytest, an OCR accuracy script, and an Android emulator walkthrough. It is **not** formal QA by the team. Test case IDs refer to `docs/OBJECTIVE_TEST_CASES.md`.

## Rules used for these proposals

- **Ready to Deploy** only when the feature was verified **and** is final. Nothing pending from PESO, nothing contradicted by the current manuscript.
- **Under Development** for anything that runs but is not final. This includes:
  - NSRP fields that still need PESO confirmation
  - the unconfirmed skills list
  - features that depend on the two approved deviations, until the manuscript and compliance matrix are updated
- **Passed** only where something actually ran and was seen to work. Otherwise **Not Yet Tested**.

The two approved deviations are:
- **One-time NSRP verification** instead of per-job PESO review (V11.49 §1.5, §2.5, §3.4.5, §3.5.3).
- **Temporary 3-skill minimum** (§3.5.1 says missing skills never block; this also contradicts the compliance-matrix answer to Mr. Tanguamos).

## Proposed changes to existing rows

| No. | Current feature name | Proposed name (if changed) | Proposed Status (adviser decides) | Proposed QA Result | Findings / evidence | Action required |
| --- | --- | --- | --- | --- | --- | --- |
| 3 | Dashboard Overview | n/a | Under Development | Passed (dev) | Seeker dashboard shows NSRP status, stats, and recent applications; checked on emulator. | Formal QA. |
| 4 | NSRP Profile Creation and Editing | NSRP Profile (NSRP Form 1 layout, sections I-VIII) | Under Development | Passed (dev) | Rebuilt to mirror NSRP Form 1 (see gap table below). Live-in, checklists, and table rows added; summaries derived; certification added. API (E-F) and emulator. | Confirm with PESO that the 2017 form is the current version; formal QA. |
| 5 | Skills Selection and Encoding | n/a | Under Development | Passed (dev) | 67 skills / 15 categories, now covering all 17 NSRP "Other Skills" items. Selection and save work. | PESO to confirm the skills list (see open questions). |
| 6 | Required NSRP Fields Check (19 items, unlocks referral request) | Required NSRP Fields Check (19 items) and Submit to PESO with certification | Under Development | Passed (dev) | Submission refused when items are missing (lists them) or the certification is unticked. E-N, E-F, PY. | PESO to confirm the 19 required items. |
| 7 | OCR-Assisted NSRP Form Scanning | n/a | Under Development | Passed (dev, sample forms only) | Every field of the two sample pages checked against the images: 81/81 (page 1 40/40, page 2 41/41), including NA fields left blank. Fixed today: language ticks are now read from each Read/Write/Speak/Understand cell (before, a printed "English" label alone marked all four as ticked); "How long looking", "If no, when?" and "Household ID" are now read. Scan works on emulator. | Test real accomplished/handwritten forms and phone photos. |
| 8 | OCR Data Review and Manual Editing | n/a | Under Development | Passed (dev) | Review now uses the same NSRP Form 1 component as the profile. Starts from the saved profile; OCR values layered on top. | Formal QA. |
| 9 | OCR Confirm and Save to Profile | n/a | Under Development | Passed (dev) | **Bug fixed:** confirming a page-2 scan used to blank page-1 fields. Now merges; education merged per level. E-F; emulator; PY test_confirm_is_explicit. | Formal QA with real forms. |
| 10 | Job Vacancy Browsing | n/a | Ready to Deploy (candidate) | Passed (dev) | Lists active jobs; hides closed, expired, and deactivated-employer jobs. Emulator, PY, E-A. | Adviser decision. |
| 11 | Job Search by Title, Company, or Keyword | n/a | Ready to Deploy (candidate) | Passed (dev) | Emulator ("cook"), PY test_search_jobs. | Adviser decision. |
| 12 | Job Type Filtering | n/a | Under Development | Not Yet Tested | Not re-tested this round. | Test on device. |
| 13 | Location Filtering | n/a | Under Development | Passed (dev) | Location chips checked on emulator in an earlier session the same day. | Formal QA. |
| 14 | Job Details View | n/a | Under Development | Passed (dev) | Checked against §3.5.1-3.5.2: position info, requirements, employer details, application email, skill comparison. New: "Not Accepting Applications" card for closed/expired jobs. | Formal QA. |
| 15 | Rule-Based Skill Comparison (Seeker View) | n/a | Under Development | Passed (dev) | One shared comparison for all views and the apply check. Message when the seeker has no saved skills (§3.5.4). Levels not used (paper compares skills only). | Depends on the skills list and the skill-minimum deviation. |
| 16 | Request PESO Referral for a Job (formerly Job Application Submission) | **Apply with PESO Referral (PESO-verified NSRP profile)** | Under Development | Passed (dev) | One tap for verified seekers; record created as PESO-Referred; employer notified. Blocked when unverified, below the skill minimum, or the job is closed. E-N, E-A; emulator. | Manuscript update (approved deviation); formal QA. |
| 17 | Duplicate Application Prevention | n/a | Ready to Deploy (candidate) | Passed (dev) | 409 on a second application to the same job; the job page shows "Your Application". E-N, PY. | Adviser decision. |
| 18 | My Applications Tracking | n/a | Under Development | Passed (dev) | Status timeline labelled PESO / Employer; Closed status with a "not a rejection" note. | Formal QA. |
| 19 | In-App Notifications (Seeker) | n/a | Under Development | Passed (dev, API) | Every seeker event creates a notification (E-N, E-A). The Alerts screen was not walked through for every event on device. | Check each alert on device. |
| 21 | Employer Dashboard Overview | n/a | Under Development | Not Yet Tested | Not re-tested this round. | Test on device. |
| 22 | Create Job Posting | n/a | Under Development | Passed (dev, API) | PY test_employer_create_update_close_job; new-job alerts to seekers. | Test on device; skills list pending. |
| 23 | Edit Job Posting | n/a | Under Development | Passed (dev, API) | Edit now notifies applicants with in-progress applications (E-A). | Test on device. |
| 24 | Close Job Posting (Employer) | n/a | Under Development | Passed (dev, API) | Closing now closes in-progress applications and notifies those seekers ("not a rejection"); Hired kept. E-A. | Test on device. |
| 25 | Select Required Skills for Job | n/a | Under Development | Not Yet Tested | Unchanged UI. The job form always saves level "beginner"; levels are not used in matching (documented). | Skills list confirmation. |
| 26 | View Applicants per Job | n/a | Under Development | Passed (dev) | Only PESO-referred applicants; NSRP summary; matched/missing skills. | Confirm with the adviser what NSRP detail employers should see. |
| 27 | Rule-Based Skill Match View (Employer) | n/a | Under Development | Passed (dev, API) | Same comparison as the seeker view. | As row 15. |
| 28 | Update Application Tracking Status | n/a | Under Development | Passed (dev) | For Review / For Interview / Hired / Rejected; no auto-reject of others. "All Vacancies Filled" alert to the employer. E-A, PY. | Manuscript status list (§3.5.3, ERD). |
| 29 | Employer Notifications | n/a | Under Development | Passed (dev, API) | New PESO-referred applicant, vacancies filled, account events, applicant records closed. | Check on device. |
| 31 | Admin Dashboard with System Stats | n/a | Under Development | Passed (dev) | NSRP waiting / verified and PESO-referred counts. Emulator. | Formal QA. |
| 32 | Create Employer Account | n/a | Ready to Deploy (candidate) | Passed (dev, API) | PY test_admin_creates_employer, test_non_admin_cannot_create_employer, test_duplicate_employer_rejected. | Adviser decision; try it once on device. |
| 33 | View and List Employer Accounts | **Manage Employer Accounts (approve/reject, edit, deactivate/reactivate)** | Under Development | Passed (dev) | The hidden approvals screen was unreachable, so pending employers could not be approved from the app; now on the Employers screen. Edit and deactivate/reactivate added (§3.5.3). E-A; emulator (screens). | Test edit/deactivate on device. |
| 34 | Manage Job Seeker Accounts | n/a | Under Development | Passed (dev, API) | Deactivation now closes in-progress applications and notifies employers. E-A, PY. | Test on device. |
| 35 | View Job Seeker NSRP Profile Before Reviewing | n/a | Under Development | Passed (dev) | Full NSRP profile in the NSRP tab, plus the uploaded form image (lazy-loaded) and the certification date. | Test the image viewer on device with a real upload. |
| 36 | Review Referral Request: Endorse / Reject with Reason / Close | **NSRP Verification: Verify / Return for Revision (with note); For Review automatic** | Under Development | Passed (dev) | One-time verification replaces per-job endorse/reject. "For use of PESO only" eligibility (SPES/GIP/TUPAD/JobStart) recorded on Verify. E-N, E-F; emulator. | Manuscript update (approved deviation); confirm the process with PESO. |
| 37 | Monitor All Job Postings | n/a | Under Development | Not Yet Tested | Not re-tested this round. | Test on device. |
| 38 | Close a Job Posting (Admin) | n/a | Under Development | Passed (dev, API) | Same closing behaviour as row 24. | Test on device. |
| 39 | Monitor All Applications | **Monitor PESO-Referred Applications (by job / by employer)** | Under Development | Passed (dev) | "By Job" view with per-job counts by status, employer filter, drill-down, search. Emulator. | Formal QA. |
| 40 | Application Status Consistency | n/a | Under Development | Passed (dev, API) | Referral vs. application history types; Closed used for closed jobs and deactivations. | Manuscript §3.5.3 / ERD status list. |
| 41 | Suspended Account Enforcement on Active Sessions | n/a | Ready to Deploy (candidate) | Passed (dev, API) | PY test_me_rejects_suspended_account; E-A (session refused right after deactivation). | Adviser decision. |
| 42 | Job-specific PESO referral routing and endorsement workflow | **PESO referral routing via one-time NSRP verification** | Under Development | Passed (dev) | Submitted, For Review, Verified, then one-tap PESO-Referred applications. Rewording needed: per-job endorsement no longer exists. | Manuscript update; PESO confirmation. |
| 43 | PESO-Referred per-application status/label handling | n/a | Under Development | Passed (dev) | Every application from a verified seeker is labelled PESO-Referred; employers see only these. | Manuscript update. |

Rows 1, 2, 20 and 30 (registration and the three logins) are unchanged and still Ready to Deploy. PY login and registration tests passed.

## Proposed new rows

| Role | Feature | Proposed Status | Proposed QA Result | Evidence |
| --- | --- | --- | --- | --- |
| Job Seeker | NSRP certification/authorization statement on submission | Under Development | Passed (dev) | E-F; emulator |
| Job Seeker | Verified profile sent back to PESO when changed (unchanged save keeps it verified) | Under Development | Passed (dev) | E-N, E-F; emulator |
| Job Seeker | Temporary minimum skill match (MIN_SKILL_MATCHES) | Under Development | Passed (dev) | E-N; emulator. Contradicts §3.5.1 until the paper is updated. |
| Employer | All-vacancies-filled alert | Under Development | Passed (dev, API) | E-A |
| PESO Admin | Deactivate/reactivate employer accounts (closes active posts) | Under Development | Passed (dev, API) | E-A |
| PESO Admin | View uploaded NSRP form image | Under Development | Passed (dev, API) | E-A |
| PESO Admin | "For use of PESO only" eligibility (SPES/GIP/TUPAD/JobStart) | Under Development | Passed (dev, API) | E-F |
| System | Closed / expired / deactivated-employer jobs hidden and not accepting applications | Under Development | Passed (dev, API) | E-A |
| System | Database upgrade keeps earlier PESO decisions | Under Development | Passed (dev) | Run on a copy of the real database |

## NSRP Form 1 vs. app: gap table (row 4)

Source: `samples/nsrp-ocr/nsrp-page-1-sample.jpg` and `nsrp-page-2-sample.jpg` (NSRP Form 1, January 2017).

| Form section / field | Before today | Now |
| --- | --- | --- |
| I. Surname, First, Middle, Suffix, Date / Place of Birth, Religion | OK | OK (form order) |
| I. Sex (Male / Female) | Had an extra "Other" option | Male / Female only (old values still display) |
| I. Civil Status incl. **Live-in** | Live-in missing (OCR could return it, but the database column did not allow it) | Added (database upgraded) |
| I. Present Address: House No./Street, Village, Barangay, Municipality/City, Province | OK, plus an extra free-text "Address" | Form fields only; summary address built from them |
| I. TIN, GSIS/SSS, PAG-IBIG, PhilHealth, Height | OK, plus an extra **Weight** (not on the form) | Weight removed from the form |
| I. Email, Landline, Cellphone | OK, plus an extra "Contact Number" | Form fields only; contact number derived |
| I. Disability checklist (Visual, Hearing, Speech, Physical, Others) | Free text | Checklist plus "Others, specify" |
| I. Employment Status / Type (Employed: Wage, Self; Unemployed: New Entrant, Finished Contract, Resigned, Retired, Terminated local/abroad + country, Others) | Free text; "Underemployed" not on the form | Form options, country / others text |
| I. Looking for work (Y/N + how long), Willing immediately (Y/N + when), 4Ps (Y/N + Household ID) | OK | OK |
| II. Preferred Occupation 1-4 | One free-text field | Four numbered fields |
| II. Preferred Work Location: Local (cities 1-3) / Overseas (countries 1-3) | Free text | Local / Overseas checks plus numbered fields |
| II. Expected Salary, Passport No., Expiry | OK | OK |
| III. Language grid (English, Filipino, Others × Read/Write/Speak/Understand) | Free text | Grid |
| IV. Education per level: School, Course, Year graduated, If undergraduate (level, year last attended), Awards | One text per level | Table row per level |
| V. Training rows: Course, Duration, Institution, Certificates | Free text | 3 rows |
| VI. Eligibility (Civil Service: rating, date of exam) / Professional License (PRC: valid until) | Free text | 2 + 2 rows |
| VII. Work Experience: Company, Address, Position, Inclusive Dates, Status | Free text | Up to 5 rows |
| VIII. Other skills checklist (17 items + Others) | Free text | Checklist plus Others |
| Certification / Authorization | Missing | Checkbox required on submit; date stored |
| For use of PESO only: SPES, GIP, TUPAD, JobStart, Others; Assessed by | Missing | Admin records it on Verify (assessor = admin account) |

Profiles saved before today keep their free-text answers ("Previously encoded" boxes) until the seeker fills the new rows.

## Open questions for PESO Misamis Oriental

1. Is one NSRP verification enough for any employer, or does PESO decide per job? (The app is approve-once.)
2. Is there a minimum skill match for referral? The app uses a temporary 3; `MIN_SKILL_MATCHES=0` turns it off.
3. Is NSRP Form 1 (January 2017) still the current version? Are any fields optional for PESO-Link?
4. Are the 19 required items the right gate for submitting to PESO?
5. Which skills or occupations should the skills list contain (for example security guard, BPO / call center, nursing aide)?
6. Should closing a job post close the remaining applicants' records, as the app now does?

## Recommendations (Chapter 5 candidates)

- Proficiency-level matching (required level vs. seeker level). Levels are stored but not compared.
- Suggest skills from the NSRP "Other Skills" checklist automatically.
- Remind a Hired seeker about their other open applications.
- Real handwritten-form OCR tuning and phone-camera capture guidance.
- Native push notifications (in-app only now).
- Change the JWT secret and review security before any real deployment.
