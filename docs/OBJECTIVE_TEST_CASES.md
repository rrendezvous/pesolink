# PESO-Link MisOr: Objective Test Cases

Test cases mapped to the study objectives (proposal V11.49 §1.3.2) and the system requirements (§3.2, §3.5).
Each case has a stable ID so it can become a QA-tracker row.

**Results** were recorded on 2026-10-04 by developer testing on the `peso_link_demo` database. This is not formal QA by the team.

- **Pass:** ran it and saw the expected result.
- **Pass (minor issue):** works, with a noted limitation.
- **Not run:** not executed this round. It says nothing about whether the feature works.

**Evidence codes**

| Code | Source |
| --- | --- |
| E-N | `backend/tests/e2e_nsrp.mjs` (47 checks) |
| E-A | `backend/tests/e2e_objective_a.mjs` (46 checks) |
| E-F | `backend/tests/e2e_nsrp_form.mjs` (19 checks) |
| PY | `backend/tests/*.py` (pytest: 62 passed, 1 skipped) |
| OCR | `backend/scripts/ocr-accuracy.js` on `samples/nsrp-ocr` |
| EMU | Android emulator (Pixel 7, Android 15, Expo Go) walkthrough, 2026-10-04 |

Run the API tests with `cd backend && npm run test:e2e` (backend running on the demo database).

> **Approved deviations from V11.49.** The manuscript must be updated before the defense.
> - **NSRP verification:** PESO verifies the NSRP profile once instead of reviewing each job request.
> - **Skill minimum:** a temporary minimum of 3 matching skills (`MIN_SKILL_MATCHES`). The paper's §3.5.1 says missing skills never block a referral request. Set `MIN_SKILL_MATCHES=0` to follow the paper exactly.

---

## Objective (a): job browsing, application tracking, notifications, centralized routing

(§1.3.2a; §3.2 requirements 1, 2, 3, 6, 7, 8, 9)

| ID | Requirement | Role | Steps | Expected | Result | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| TC-A-01 | Browse localized job vacancies (§3.5.1, Req 1) | Seeker | Open Jobs | Active jobs listed with company, type, location | Pass | EMU; PY test_list_jobs |
| TC-A-02 | Search jobs (§3.5.1) | Seeker | Type "cook" in search | Only Food Kiosk Cook shown | Pass | EMU; PY test_search_jobs |
| TC-A-03 | Filter by job type / location (§3.5.1) | Seeker | Tap a type chip, then a location chip | List narrows to matching jobs | Pass | EMU (earlier session, 2026-10-04) |
| TC-A-04 | Job details: position info, requirements, employer details, application email (§3.5.1, §3.5.2) | Seeker | Open Junior Software Developer | All sections shown; "Apply Directly" card shows careers@techcorp.ph | Pass | EMU; PY test_job_details |
| TC-A-05 | Closed or expired jobs are not offered | Seeker | Employer closes a job / sets the closing date to yesterday; seeker browses and tries to apply | Job hidden; apply refused with "closed" message | Pass | E-A |
| TC-A-06 | Submit NSRP profile to PESO with certification (§3.5.1) | Seeker | Complete 19 items, tick the certification, tap Submit | Status Submitted; admins notified; refused without certification | Pass | E-N, E-F; EMU (checkbox and disabled button seen) |
| TC-A-07 | PESO opens a submitted profile and it becomes For Review (§3.5.3) | Admin | NSRP tab, tap Juan | Status For Review; seeker notified | Pass | E-N; EMU |
| TC-A-08 | PESO verifies the NSRP profile (§3.5.3) | Admin | Verify NSRP Profile, then Confirm | PESO-Verified; seeker notified | Pass | E-N; EMU |
| TC-A-09 | PESO returns a profile for revision; note required | Admin | Return without a note, then with a note | Refused without a note; Needs Revision with note shown to seeker | Pass | E-N, PY |
| TC-A-10 | Apply with PESO referral in one tap (§3.5.1, Req 2-3) | Seeker | Verified seeker opens Food Kiosk Cook, taps Apply | Record is PESO-Referred / For Review; employer notified | Pass | E-N; EMU |
| TC-A-11 | Unverified seeker cannot apply with PESO referral | Seeker | Submitted / Needs-Revision seeker taps Apply | Refused: "must be PESO-verified" | Pass | E-N, PY |
| TC-A-12 | No duplicate application per job | Seeker | Apply twice to the same job | Second attempt refused (409) | Pass | E-N, PY |
| TC-A-13 | Temporary skill minimum (approved deviation) | Seeker | Open a job with 0 of 4 skills matched; try to apply | "Needs at least 3 matching skills" and no Apply button; API refuses | Pass | E-N; EMU |
| TC-A-14 | Changed verified profile goes back to PESO; unchanged save does not | Seeker | Save with no changes; then change a field or skill | Unchanged: stays Verified. Changed: Submitted, admins and seeker notified, cannot apply until re-verified | Pass | E-N, E-F; EMU (unchanged save) |
| TC-A-15 | Employer sees only PESO-referred applicants, with NSRP summary and matched/missing skills (§3.5.2) | Employer | Open the job's applicants | Only referred applicants; summary and skills shown | Pass | E-N; EMU (earlier session) |
| TC-A-16 | Employer updates application status; seeker sees the timeline (§3.5.2) | Employer, seeker | Set For Interview, then Hired / Rejected | Status saved; seeker notified; timeline shows "Employer: …" | Pass | E-N, E-A, PY; EMU (earlier session) |
| TC-A-17 | Many applicants, one hired (what-if) | Employer | Two applicants; hire one | Other applicant stays For Review (no auto-reject, no rejection notice); employer told when all vacancies are filled | Pass | E-A |
| TC-A-18 | Job closed while applicants are in progress (what-if) | Employer | Close the job | In-progress applications become Closed; seekers told "not a rejection"; Hired stays Hired | Pass | E-A |
| TC-A-19 | Job post updated after people applied (Req 6, "job posting updates") | Employer | Edit the job | Applicants with in-progress applications notified | Pass | E-A |
| TC-A-20 | Admin deactivates a seeker mid-flow (Req 9) | Admin | Deactivate a seeker who has an application; then reactivate | Seeker's session refused; application Closed; employer notified; works again after reactivation | Pass | E-A, PY |
| TC-A-21 | Admin deactivates an employer (Req 7) | Admin | Deactivate Northstar; then reactivate | Login refused; active posts closed and hidden; applicants' records closed; posts stay closed after reactivation | Pass | E-A |
| TC-A-22 | Admin edits employer details (§3.5.3) | Admin | Edit Details, then Save | Saved; employer notified; blank name and bad size refused | Pass | E-A; EMU (screen and buttons seen, not edited on device) |
| TC-A-23 | Admin approves / rejects a pending employer (§3.5.3) | Admin | Employers, Pending filter, Approve | Approved; employer notified | Pass | E-A, PY; EMU (pending card with buttons seen) |
| TC-A-24 | Admin creates an employer account; employers cannot self-register (§3.5.2-3) | Admin | Create Employer Account | Account active; self-registration blocked | Pass | PY test_admin_creates_employer, test_register_employer_blocked |
| TC-A-25 | Admin monitoring of referral records (§3.5.3) | Admin | Referrals, By Job, tap a job | Per-job counts by status; drill-down to applicants; employer filter; search | Pass | EMU |
| TC-A-26 | Admin dashboard counts | Admin | Open Home | Users, jobs, applications, NSRP waiting / verified, PESO-referred counts | Pass | EMU; E-N; PY |
| TC-A-27 | In-app notification list shows each event | All | Open Alerts after each event | Each notification listed and readable | Not run on device (API verified each notification exists: E-N, E-A) | |
| TC-A-28 | Role-based access (§3.5.4) | All | Seeker calls an admin or employer endpoint | 403 | Pass | PY, E-A |

## Objective (b): NSRP-based profile encoding, optional OCR, rule-based skill matching

(§1.3.2b; §3.2 requirements 4, 5, 10)

| ID | Requirement | Role | Steps | Expected | Result | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| TC-B-01 | Profile follows NSRP Form 1 sections I-VIII (§3.5.1, Req 4) | Seeker | Open Profile and scroll | Sections, labels, checklists, and table rows match the official form | Pass | EMU; gap table in QA_TRACKER_PROPOSED_UPDATES.md |
| TC-B-02 | Live-in civil status (form option) | Seeker | Choose Live-in and save | Saved | Pass | E-F |
| TC-B-03 | Form rows fill the summary fields | Seeker | Save education rows | Highest level, course, and background text derived | Pass | E-F |
| TC-B-04 | 19 required NSRP items gate submission | Seeker | Submit with missing items | Refused with a list of missing items | Pass | E-N, PY |
| TC-B-05 | Typing in the form keeps focus | Seeker | Type in a training row | All characters entered; keyboard stays | Pass | EMU |
| TC-B-06 | OCR page 1 extraction (Req 5) | Seeker | `node scripts/ocr-accuracy.js` | Every field matches the sample image; NA fields stay blank | Pass: 40/40 fields | OCR |
| TC-B-07 | OCR page 2 extraction (education, training, work, skills) | Seeker | Same script; on device: Gallery, page 2, Scan | Every field matches the sample image; NA fields stay blank | Pass: 41/41 fields | OCR; EMU |
| TC-B-08 | OCR data is not saved without confirmation (§3.5.1) | Seeker | Scan, then leave without confirming | Profile unchanged | Pass | PY test_confirm_is_explicit |
| TC-B-09 | Scanning one page does not erase the other page's data | Seeker | Scan page 2 for a seeker with page-1 data; confirm | Page-1 fields kept; education merged per level | Pass | E-F; EMU (review kept page-1 data) |
| TC-B-10 | OCR on real accomplished (handwritten) NSRP forms | Seeker | Photograph real forms | Reasonable pre-fill | Not run (samples are typed forms) | |
| TC-B-11 | Rule-based matched/missing skills, same in every view (Req 10, §3.5.4) | Seeker, employer, admin | Open a job / applicant / referral record | Same matched and missing lists; no score or ranking | Pass | E-N, E-A, PY; EMU |
| TC-B-12 | Comparison only after skills are saved (§3.5.4) | Seeker | Seeker with no skills opens a job | Message to add skills plus the required skills list | Pass (API) | E-A; not run on device |
| TC-B-13 | Skills list covers the NSRP "Other Skills" checklist | n/a | Check `seed-skills.js` | All 17 NSRP VIII items covered (67 skills) | Pass (needs PESO confirmation to be final) | Code |
| TC-B-14 | Admin views the uploaded NSRP form image | Admin | Open a profile with an upload, Show Uploaded Form | Image shown next to encoded data | Pass (API) | E-A; not run on device |
| TC-B-15 | "For use of PESO only" eligibility recorded on verify | Admin | Tick SPES/GIP/TUPAD/JobStart, then Verify | Saved with assessor and date | Pass (API) | E-F; not run on device |

## Objective (c): test and evaluate functionality and usability

(§1.3.2c; ISO 25010, SUS)

| ID | Item | Result | Evidence |
| --- | --- | --- | --- |
| TC-C-01 | Automated API end-to-end tests | Pass: 112/112 | E-N, E-A, E-F |
| TC-C-02 | Backend regression suites (pytest) | Pass: 62 passed, 1 skipped (conditional test; no profile waiting at that point in the run) | PY |
| TC-C-03 | TypeScript type-check and Expo lint | Pass: 0 errors (11 older warnings) | `npx tsc --noEmit`, `npx expo lint` |
| TC-C-04 | Database upgrade on a copy of the real database | Pass: existing decisions kept; repeat run does nothing | Copy of peso_link_misor (deleted afterwards) |
| TC-C-05 | ISO 25010 functional-suitability evaluation with respondents | Not run (team activity) | |
| TC-C-06 | SUS usability questionnaire with respondents | Not run (team activity) | |
