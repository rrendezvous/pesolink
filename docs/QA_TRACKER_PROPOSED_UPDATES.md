# QA Tracker: Proposed Updates (PESO-Link sheet)

- **Based on:** `docs/QA Tracker Upd - Oct 4 2026.xlsm`, sheet "PESO-Link", rows 11-53 (row numbers below are the tracker's "No." column).
- **The tracker file was not edited.** These are proposals for the team. The adviser sets the **Status** column.
- **Evidence** is developer testing on the demo database, first on 2026-10-04 and re-checked on 2026-10-05: API tests, pytest, an OCR accuracy script, and Android emulator walkthroughs. It is **not** formal QA by the team. Test case IDs refer to `docs/OBJECTIVE_TEST_CASES.md`.
- **2026-10-05 recheck:** full run as the sample's owner (register, OCR both pages, submit, verify, apply, employer status update) plus every role on the emulator. Five app bugs were found and fixed (rows 4, 9, 23, 26, 36); see "Fixed in the 2026-10-05 recheck" below.

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
| 4 | NSRP Profile Creation and Editing | NSRP Profile (NSRP Form 1 layout, sections I-VIII) | Under Development | Passed (dev) | Re-checked item by item against both pages of NSRP Form 1 (table below). 2026-10-05 fixes: the full certification text (the last sentence was missing), the form's instructions line, the official column order for education and training, and Suffix in the read-only views. **Bug fixed:** the Profile tab never reloaded, so after an OCR save it showed the old, mostly empty form, and saving it would have overwritten the OCR data. | Confirm with PESO that the 2017 form is current; formal QA. |
| 5 | Skills Selection and Encoding | n/a | Under Development | Passed (dev) | 67 skills / 15 categories, now covering all 17 NSRP "Other Skills" items. Selection and save work. | PESO to confirm the skills list (see open questions). |
| 6 | Required NSRP Fields Check (19 items, unlocks referral request) | Required NSRP Fields Check (19 items) and Submit to PESO with certification | Under Development | Passed (dev) | Submission refused when items are missing (lists them) or the certification is unticked. E-N, E-F, PY. | PESO to confirm the 19 required items. |
| 7 | OCR-Assisted NSRP Form Scanning | n/a | Under Development | Passed (dev, sample forms only) | Every field of the two sample pages checked against the images: 81/81 (page 1 40/40, page 2 41/41), including NA fields left blank. Fixed today: language ticks are now read from each Read/Write/Speak/Understand cell (before, a printed "English" label alone marked all four as ticked); "How long looking", "If no, when?" and "Household ID" are now read. Scan works on emulator. | Test real accomplished/handwritten forms and phone photos. |
| 8 | OCR Data Review and Manual Editing | n/a | Under Development | Passed (dev) | Review now uses the same NSRP Form 1 component as the profile. Starts from the saved profile; OCR values layered on top. | Formal QA. |
| 9 | OCR Confirm and Save to Profile | n/a | Under Development | Passed (dev) | Merges instead of overwriting (page-1 data survives a page-2 scan); all uploads in the review marked confirmed; database checked after an emulator run on 2026-10-05. The OCR screen now reloads the saved profile on every visit and starts fresh after a confirm. | Formal QA with real forms. |
| 10 | Job Vacancy Browsing | n/a | Ready to Deploy (candidate) | Passed (dev) | Lists active jobs; hides closed, expired, and deactivated-employer jobs. Emulator, PY, E-A. | Adviser decision. |
| 11 | Job Search by Title, Company, or Keyword | n/a | Ready to Deploy (candidate) | Passed (dev) | Emulator ("cook"), PY test_search_jobs. | Adviser decision. |
| 12 | Job Type Filtering | n/a | Under Development | Passed (dev) | Type chips checked on the emulator on 2026-10-05 (right result and "No jobs found" message). | Formal QA. |
| 13 | Location Filtering | n/a | Under Development | Passed (dev) | Location chips checked on the emulator on 2026-10-04 and 2026-10-05. | Formal QA. |
| 14 | Job Details View | n/a | Under Development | Passed (dev) | Checked against §3.5.1-3.5.2: position info, requirements, employer details, application email, skill comparison. "Not Accepting Applications" card for closed/expired jobs. **Bug fixed 2026-10-05:** reopening the same job showed the old apply/match state; it now reloads on every visit. | Formal QA. |
| 15 | Rule-Based Skill Comparison (Seeker View) | n/a | Under Development | Passed (dev) | One shared comparison for all views and the apply check. Message when the seeker has no saved skills (§3.5.4). Levels not used (paper compares skills only). | Depends on the skills list and the skill-minimum deviation. |
| 16 | Request PESO Referral for a Job (formerly Job Application Submission) | **Apply with PESO Referral (PESO-verified NSRP profile)** | Under Development | Passed (dev) | One tap for verified seekers; record created as PESO-Referred; employer notified. Blocked when unverified, below the skill minimum, or the job is closed. E-N, E-A; emulator. | Manuscript update (approved deviation); formal QA. |
| 17 | Duplicate Application Prevention | n/a | Ready to Deploy (candidate) | Passed (dev) | 409 on a second application to the same job; the job page shows "Your Application". E-N, PY. | Adviser decision. |
| 18 | My Applications Tracking | n/a | Under Development | Passed (dev) | Status timeline labelled PESO / Employer; Closed status with a "not a rejection" note. | Formal QA. |
| 19 | In-App Notifications (Seeker) | n/a | Under Development | Passed (dev) | Every seeker event creates a notification (E-N, E-A). Seeker Alerts checked on the emulator on 2026-10-05: For Review, Verified, For Interview, Job Post Updated. | Formal QA. |
| 21 | Employer Dashboard Overview | n/a | Under Development | Passed (dev) | Company card, created/active/applicant counts and recent posts checked on the emulator on 2026-10-05. | Formal QA. |
| 22 | Create Job Posting | n/a | Under Development | Passed (dev, API) | PY test_employer_create_update_close_job; new-job alerts to seekers. On device, Post New Job now opens a blank form (it used to keep old entries); not submitted on device. | Skills list pending. |
| 23 | Edit Job Posting | n/a | Under Development | Passed (dev) | Edit notifies applicants with in-progress applications (E-A; emulator). **Bug fixed 2026-10-05:** editing the same job a second time showed the values from before the last save, and saving would have undone the change. | Formal QA. |
| 24 | Close Job Posting (Employer) | n/a | Under Development | Passed (dev, API) | Closing now closes in-progress applications and notifies those seekers ("not a rejection"); Hired kept. E-A. | Test on device. |
| 25 | Select Required Skills for Job | n/a | Under Development | Not Yet Tested | Unchanged UI. The job form always saves level "beginner"; levels are not used in matching (documented). | Skills list confirmation. |
| 26 | View Applicants per Job | n/a | Under Development | Passed (dev) | Only PESO-referred applicants: contact, NSRP summary, matched/missing skills, cover letter (emulator). **Bug fixed 2026-10-05:** the Applicants tab opened from the tab bar called the server with no job and showed "No PESO-referred applicants yet"; it now lists the job posts to choose from. | Confirm with the adviser what NSRP detail employers should see. |
| 27 | Rule-Based Skill Match View (Employer) | n/a | Under Development | Passed (dev, API) | Same comparison as the seeker view. | As row 15. |
| 28 | Update Application Tracking Status | n/a | Under Development | Passed (dev) | For Review / For Interview / Hired / Rejected; no auto-reject of others; "All Vacancies Filled" alert to the employer. E-A, PY; For Interview set on the emulator on 2026-10-05. | Manuscript status list (§3.5.3, ERD). |
| 29 | Employer Notifications | n/a | Under Development | Passed (dev, API) | New PESO-referred applicant, vacancies filled, account events, applicant records closed. | Check on device. |
| 31 | Admin Dashboard with System Stats | n/a | Under Development | Passed (dev) | NSRP waiting / verified and PESO-referred counts. Emulator. | Formal QA. |
| 32 | Create Employer Account | n/a | Ready to Deploy (candidate) | Passed (dev, API) | PY test_admin_creates_employer, test_non_admin_cannot_create_employer, test_duplicate_employer_rejected. | Adviser decision; try it once on device. |
| 33 | View and List Employer Accounts | **Manage Employer Accounts (approve/reject, edit, deactivate/reactivate)** | Under Development | Passed (dev) | Approve (Blue Mountain) and deactivate/reactivate (Northstar: "4 active job post(s) were closed.", sign-in refused, then allowed) done on the emulator on 2026-10-05. Edit: API only (E-A). | Formal QA. |
| 34 | Manage Job Seeker Accounts | n/a | Under Development | Passed (dev, API) | Deactivation now closes in-progress applications and notifies employers. E-A, PY. | Test on device. |
| 35 | View Job Seeker NSRP Profile Before Reviewing | n/a | Under Development | Passed (dev) | Full NSRP profile, uploaded form images (checked on the emulator with a real two-page upload on 2026-10-05), certification date. Option values now shown with the form's labels ("Male", "New Entrant/Fresh Graduate"). | Formal QA. |
| 36 | Review Referral Request: Endorse / Reject with Reason / Close | **NSRP Verification: Verify / Return for Revision (with note); For Review automatic** | Under Development | Passed (dev) | One-time verification replaces per-job endorse/reject. "For use of PESO only" eligibility recorded on Verify. Emulator 2026-10-05: For Review on open, note required to return, Verify with JobStart. **Bug fixed:** re-verifying a changed profile wiped the earlier eligibility because the panel always opened blank; it now starts from PESO's last assessment. | Manuscript update (approved deviation); confirm the process with PESO. |
| 37 | Monitor All Job Postings | n/a | Under Development | Passed (dev) | List with status, applicant count, and Close Job checked on the emulator on 2026-10-05. | Formal QA. |
| 38 | Close a Job Posting (Admin) | n/a | Under Development | Passed (dev) | Same closing behaviour as row 24; closed from the emulator on 2026-10-05. | Formal QA. |
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
| Employer | Applicants tab lists job posts when no job is selected | Under Development | Passed (dev) | Emulator, 2026-10-05 |

## Fixed in the 2026-10-05 recheck

| Symptom | Root cause | Fix |
| --- | --- | --- |
| Profile showed 5/19 items right after an OCR save; Save Profile would have overwritten the OCR data with blanks | The Profile tab stays mounted and loaded only once | Reload on every visit (`profile.tsx`) |
| Editing the same job twice showed pre-save values; Post New Job kept old entries | The hidden job-form tab stays mounted and loaded only once | Reload on every visit; a new post starts blank (`job-form.tsx`, `manage-jobs.tsx`) |
| Reopening the same job showed the old apply/match state | Same, job details screen | Reload on every visit (`job/[id].tsx`) |
| OCR Assistant could merge onto an out-of-date profile; the old review stayed after a confirm | Saved profile loaded once; review not cleared | Reload on every visit; clear the review after Confirm and Save (`upload-nsrp.tsx`) |
| Employer Applicants tab said "No PESO-referred applicants yet" | Opened from the tab bar with no job, the screen called `/employer/jobs/undefined/applicants` (404) | List the employer's job posts to choose from (`applicants.tsx`) |
| Re-verifying a changed profile erased the "For use of PESO only" eligibility | The decision panel always opened blank and Verify saves exactly what is ticked | Pre-fill from the last assessment (`manage-job-seekers.tsx`) |
| Certification statement was missing "I am also aware that DOLE is not obliged to seek employment on my behalf." | Shortened text | Full NSRP Form 1 text (`profile.tsx`) |
| pytest: 3 failures in TestDeactivateReactivate | Test compared the stored email case-sensitively; the backend now lowercases emails (commit 2ff121c) | Test expects the normalized email |

## NSRP Form 1 vs. app: item by item (row 4, re-checked 2026-10-05)

Source: both pages of NSRP Form 1 (January 2017) in `samples/nsrp-ocr/`. Compared with `NsrpForm.tsx`, `nsrpForm.js`, `nsrpProfileValidation.js` (and its copy in `profile.tsx`), `NsrpProfileView.tsx`, and the OCR mapping in `nsrpOcr.js`.

| Form item | Options / rows on the form | App | Result |
| --- | --- | --- | --- |
| Header: NSRP Form 1, January 2017 | n/a | Named in the form's instructions line | OK |
| INSTRUCTIONS ("do not leave any items unanswered", "Indicate NA if not applicable") | n/a | Was missing; now shown at the top of the form. The app uses a blank field for NA, and OCR turns a written "NA" into a blank | Fixed 2026-10-05 (different by design: blank = NA) |
| I. Surname, First Name, Middle Name, Suffix (Sr., Jr., III) | 4 fields, form order | Same order; Suffix placeholder now says "Leave blank if none" | OK |
| I. Date of Birth (mm/dd/yyyy) | 1 field | Typed as YYYY-MM-DD (stored as a date); OCR converts mm/dd/yyyy | Different (format only) |
| I. Place of Birth, Religion | 1 field each | Same | OK |
| I. Sex | Male, Female | Male, Female | OK |
| I. Civil Status | Single, Married, Widowed, Separated, Live-in | Same five, same order | OK |
| I. Present Address | House No./Street, Village, Barangay, Municipality/City, Province | Same five | OK |
| I. TIN, GSIS/SSS ID No., PAG-IBIG No., PhilHealth No. | 4 fields | Same | OK |
| I. Height, Email Address, Landline Number, Cellphone Number | 4 fields | Same | OK |
| I. Disability | Visual, Hearing, Speech, Physical, Others (specify) | Same, with "Others, specify" text | OK |
| I. Employment Status / Type | Employed: Wage, Self. Unemployed: New Entrant/Fresh Graduate, Finished Contract, Resigned, Retired, Terminated/Laidoff (local), Terminated/Laidoff (abroad) + specify country, Others + specify | Same options and specify fields | OK |
| I. Actively looking for work? (Yes/No) + How long | 2 items | Same | OK (see open question 7 about the sample) |
| I. Willing to work immediately? (Yes/No) + If no, when? | 2 items | Same | OK |
| I. 4Ps beneficiary? (Yes/No) + Household ID No. | 2 items | Same | OK |
| II. Preferred Occupation | 4 rows | 4 rows | OK |
| II. Preferred Work Location | Local (cities 1-3) / Overseas (countries 1-3) | Local / Overseas checks, 3 + 3 rows | OK |
| II. Expected Salary (Range), Passport No., Expiry date | 3 fields | Same | OK |
| III. Language / Dialect Proficiency | English, Filipino, Others; Read, Write, Speak, Understand | Same grid; "Others" with a name field | OK |
| IV. Educational Background | Elementary, Secondary, Tertiary, Graduate Studies; School, Course, Year graduated, If undergraduate (what level, year last attended), Awards | Same rows; columns now in the form's order (Awards moved last) | Fixed 2026-10-05 (order) |
| V. Technical/Vocational and Other Training | 3 rows: Course, Duration, Training Institution, Certificates Received; note "Include courses taken as part of college education" | 3 rows; columns now in the form's order; note added | Fixed 2026-10-05 (order, note) |
| VI. Eligibility (Civil Service) / Professional License (PRC) | 2 rows (rating, date of exam) + 2 rows (valid until) | Same | OK |
| VII. Work Experience | 5 rows: Company, Address (City/Municipality), Position, Inclusive Dates, Status; "Limit to 10 year period" | Up to 5 rows (grows as filled); same columns and hint | OK |
| VIII. Other Skills Acquired Without Formal Training | 17 items + Others | Same 17 in the same order + Others | OK |
| Certification / Authorization | Full statement | Was missing the last sentence; now the full statement, required before submitting; acceptance date stored | Fixed 2026-10-05 |
| Signature of Applicant, Date | 2 lines | Certification checkbox plus stored acceptance date | Different (digital equivalent) |
| For use of PESO only: eligible for SPES, GIP, TUPAD, JobStart, Others (specify) | 5 options | Same, recorded on Verify; now kept on re-verify | OK (re-verify fixed 2026-10-05) |
| Assessed by (signature over printed name), Date | 2 lines | Admin account and date stored; shown as "Last PESO Action ... by" | Different (digital equivalent) |
| Read-only profile view (admin, referrals) | n/a | Suffix was not shown; option values were raw ("male") | Fixed 2026-10-05 |
| 19 required items (backend and the copy in `profile.tsx`) | Form says answer everything | 19 core items gate submission; the two copies agree after a save | Needs PESO confirmation |
| OCR mapping | Every printed field | Same keys as the form; 81/81 on the samples; NA comes back blank | OK |

Profiles saved before 2026-10-04 keep their free-text answers ("Previously encoded" boxes) until the seeker fills the new rows. A hidden `weight` key from older profiles is kept in the data but not shown (not on the form).

## Open questions for PESO Misamis Oriental

1. Is one NSRP verification enough for any employer, or does PESO decide per job? (The app is approve-once.)
2. Is there a minimum skill match for referral? The app uses a temporary 3; `MIN_SKILL_MATCHES=0` turns it off.
3. Is NSRP Form 1 (January 2017) still the current version? Are any fields optional for PESO-Link?
4. Are the 19 required items the right gate for submitting to PESO?
5. Which skills or occupations should the skills list contain (for example security guard, BPO / call center, nursing aide)?
6. Should closing a job post close the remaining applicants' records, as the app now does?
7. The sample form's "Are you actively looking for work?" row shows only one checkbox (before "No"), yet "How long" says 1 MONTH. The app reads it as No. Is the official form printed this way, and how should PESO read it?
8. Should the Section VIII "Other Skills" ticks (for example Computer Literate) count as matching skills? Today only the skills the seeker picks in the Skills list are used for matching. The compliance matrix says confirmed OCR skills may be used.
9. Is typing the date of birth as YYYY-MM-DD acceptable, or should the app accept mm/dd/yyyy like the form?

## Recommendations (Chapter 5 candidates)

- Proficiency-level matching (required level vs. seeker level). Levels are stored but not compared.
- Suggest skills from the NSRP "Other Skills" checklist automatically.
- Remind a Hired seeker about their other open applications.
- Real handwritten-form OCR tuning and phone-camera capture guidance.
- Native push notifications (in-app only now).
- Change the JWT secret and review security before any real deployment.
