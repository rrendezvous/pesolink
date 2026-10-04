# PESO-Link QA Tracker Groupmate Guide v1.6

## 1. What This Tracker Is For

Ma'am asked us to update the system QA tracker because we cannot meet this week.

This tracker is for monitoring the development progress of PESO-Link MisOr. It is not meant to claim that the whole system is already finished or fully deployment-ready.

The tracker should honestly show what is already in progress, what is not yet implemented, and what still needs testing, validation, or alignment with the current V11.49 capstone paper.

## 2. Current Final Count

```text
Ready to Deploy: 0
Under Development: 34
Not Yet Implemented: 2
```

We intentionally marked `0` features as `Ready to Deploy` because we do not want to overclaim readiness while these are still pending:

- Live MySQL/API validation
- End-to-end testing
- NSRP/OCR validation
- V11.49 referral workflow alignment

## 3. Meaning Of Each Status

### Ready to Deploy

Only use this if the feature is implemented, aligned with V11.49, tested enough, and ready for demo/deployment preparation.

### Under Development

Use this if the feature exists but still needs testing, database/API validation, workflow cleanup, wording cleanup, NSRP/OCR validation, or V11.49 alignment.

### Not Yet Implemented

Use this if the feature required by the paper/compliance matrix is not yet present in the code.

## 4. What Groupmates Should Copy

Open this file:

```text
CAPSTONE_System_QA_Tracker_PESO-Link_v1.6.xlsx
```

Use only the `PESO-Link` worksheet.

Copy the rows from the `PESO-Link` worksheet into Ma'am's assigned group worksheet.

At minimum, copy:

- User Role
- Feature or Module
- Status

If Ma'am's tracker includes the QA columns too, keep:

- QA Result: `Not Yet Tested`
- QA Findings or Issues: blank
- Action Required: blank
- QA Date: blank

### Copy-Paste Table

| No. | User Role | Feature or Module | Status |
|---:|---|---|---|
| 1 | System-Wide / All Roles | Android frontend TypeScript/lint readiness pending full deployment validation | Under Development |
| 2 | System-Wide / All Roles | Backend API source syntax and route loading pending live MySQL validation | Under Development |
| 3 | System-Wide / All Roles | MySQL schema, seed data, and live database readiness | Under Development |
| 4 | System-Wide / All Roles | Android deployment/APK build artifact configuration | Under Development |
| 5 | System-Wide / All Roles | Backend URL and LAN phone testing configuration | Under Development |
| 6 | System-Wide / All Roles | Suspended-account login blocking and active-session enforcement | Under Development |
| 7 | Job Seeker | Self-registration, login, logout, and role-based routing | Under Development |
| 8 | Job Seeker | NSRP-based profile creation/editing pending official NSRP field-completeness validation | Under Development |
| 9 | Job Seeker | Skills selection for profile and saved skill set | Under Development |
| 10 | Job Seeker | OCR-assisted NSRP image upload or camera capture pending live-device/API validation | Under Development |
| 11 | Job Seeker | OCR extraction review, manual editing, and confirmed save pending real-form OCR validation | Under Development |
| 12 | Job Seeker | Active job vacancy browsing | Under Development |
| 13 | Job Seeker | Keyword search and job-type filtering | Under Development |
| 14 | Job Seeker | Location filtering in the Job Seeker interface | Under Development |
| 15 | Job Seeker | Job details, employer details, and application instructions pending application/referral wording cleanup | Under Development |
| 16 | Job Seeker | Rule-based matched/missing skill comparison pending end-to-end validation | Under Development |
| 17 | Job Seeker | Application submission flow pending job-specific PESO referral alignment | Under Development |
| 18 | Job Seeker | Duplicate application prevention and application detail records | Under Development |
| 19 | Job Seeker | My Applications status tracking pending PESO-Referred alignment | Under Development |
| 20 | Job Seeker | In-app notification generation, list, and read status pending live status-update validation | Under Development |
| 21 | Employer | Login through PESO Admin-created employer account | Under Development |
| 22 | Employer | Create and update job postings with requirements, skills, and employer-provided application instructions | Under Development |
| 23 | Employer | Close job postings while retaining monitoring records | Under Development |
| 24 | Employer | View applicants with NSRP summary pending PESO-Referred endorsement alignment | Under Development |
| 25 | Employer | Update current application tracking status pending PESO-Referred alignment | Under Development |
| 26 | PESO Admin | Dashboard and monitoring overview | Under Development |
| 27 | PESO Admin | Create and list PESO Admin-created employer accounts | Under Development |
| 28 | PESO Admin | Manage job seeker accounts and deactivate/reactivate users | Under Development |
| 29 | PESO Admin | Monitor and close job postings | Under Development |
| 30 | PESO Admin | NSRP profile review UI and Referral-Ready/Needs Revision controls | Under Development |
| 31 | PESO Admin | Job-specific PESO referral routing and endorsement workflow | Not Yet Implemented |
| 32 | PESO Admin | PESO Admin application monitoring pending referral processing controls | Under Development |
| 33 | System-Wide / All Roles | PESO-Referred per-application status/label handling | Not Yet Implemented |
| 34 | System-Wide / All Roles | Application submitted/pending status history consistency | Under Development |
| 35 | PESO Admin | Legacy employer approval/rejection workflow cleanup | Under Development |
| 36 | System-Wide / All Roles | Live MySQL/API regression testing with seeded three roles | Under Development |

## 5. Important Reminder

Do not change any `Under Development` row to `Ready to Deploy` just because a screen or route exists.

The app has many implemented parts, but most are still not fully validated or not fully aligned with the current V11.49 paper.

## 6. Main Reasons Most Items Are Under Development

- Live MySQL/API validation is blocked.
- End-to-end testing is not finished.
- NSRP field completeness still needs validation against the official/source NSRP form.
- OCR has only been smoke-tested and still needs real-form validation.
- The job-specific PESO referral workflow still needs alignment with V11.49.
- PESO-Referred status handling is not yet implemented.
- Some application/status wording still needs cleanup.
- Some employer/account-control logic still needs cleanup.
- APK/demo deployment setup still needs validation.

## 7. Not Yet Implemented Items

These are the two items that should stay `Not Yet Implemented`:

- Job-specific PESO referral routing and endorsement workflow
- PESO-Referred per-application status/label handling

## 8. Optional Wording Cleanup

If the tracker still has the older wording, use these cleaner labels when copying into Ma'am's tracker. These do not change the final count.

```text
Ready to Deploy: 0
Under Development: 34
Not Yet Implemented: 2
```

Use these wording updates:

- Rename `System Wide` to `System-Wide / All Roles`.
- Rename Row 20 to `In-app notification generation, list, and read status pending live status-update validation`.
- Rename Row 22 to `Create and update job postings with requirements, skills, and employer-provided application instructions`.

Do not change the statuses unless a specific row is proven wrong by code, paper alignment, and testing evidence.
