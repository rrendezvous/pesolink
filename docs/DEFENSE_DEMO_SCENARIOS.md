# PESO-Link MisOr: Defense Demo Scenarios (screen-recording scripts)

One recording per objective, plus "what-if" recordings. Each script lists the starting state, every step, and what the viewer should see.
Test case IDs refer to `docs/OBJECTIVE_TEST_CASES.md`.

## Before every recording

1. Reset the demo data: `cd backend` then `npm run reset-demo`. This only touches `peso_link_demo`. **Never** run `init-db` on the real database.
2. Start the backend on the demo database. In Windows cmd, run these as separate lines: `set DB_NAME=peso_link_demo`, then `set DB_HOST=127.0.0.1`, then `npm start`. In Git Bash: `DB_HOST=127.0.0.1 DB_NAME=peso_link_demo npm start`.
3. Start the app: `cd frontend` then `npx expo start`, and open it in Expo Go.
4. On the emulator, run `adb reverse tcp:8001 tcp:8001` and `adb reverse tcp:8081 tcp:8081` again if adb reconnects. A dark "Cannot connect to Expo CLI" toast at the bottom is an Expo Go development message (it never appears in a release build). Close it with its X before recording, because it covers the bottom buttons.

### Seeded accounts

All passwords are `Test@123` except the admin's.

| Account | Starting state |
| --- | --- |
| admin@peso.gov.ph / `Admin@123` | PESO Admin |
| juan.cruz@example.com | NSRP **Submitted**, waiting for PESO |
| maria.santos@example.com | **PESO-Verified**; applied to IT Support Staff |
| pedro.reyes@example.com | NSRP **Needs Revision** (PESO note asks for SSS number and training dates) |
| ana.bautista@example.com | **PESO-Verified**; no applications |
| hr@techcorp.ph | Approved employer: Junior Software Developer, IT Support Staff |
| hr@northstar.ph | Approved employer: Store Cashier, Warehouse Clerk, Delivery Rider, Food Kiosk Cook |
| hr@bluemountain.ph | **Pending** employer approval |

> **Note.** If the manuscript has not been updated yet for the 3-skill minimum, start the backend with `MIN_SKILL_MATCHES=0` so the app matches §3.5.1 of the paper (missing skills never block).

---

## Recording 1: Objective (a). Browse, route, track, notify (about 6 min)

1. **Admin verifies an NSRP profile** (TC-A-07, A-08)
   - Log in as admin. The Home dashboard shows *1 NSRP Awaiting PESO*.
   - Open the **NSRP** tab. Needs Action shows Juan Cruz (Submitted).
   - Tap Juan. The badge changes to **For Review** automatically.
   - Scroll through the NSRP profile (sections I-VIII) and the encoded skills.
   - Optionally tick **TUPAD** under "For use of PESO only", then tap **Verify NSRP Profile**, then **Verify**.
   - *Shown:* "Saved … The job seeker has been notified."
2. **Seeker browses and applies** (TC-A-01 to A-04, A-10)
   - Log out, then log in as Juan. Home shows **NSRP: PESO-Verified**.
   - Jobs: search "developer"; also tap a location chip.
   - Open **Junior Software Developer**. Show the employer details, requirements, the skill comparison (4/4 matched, "Meets the minimum"), and the "Apply Directly to the Employer" email.
   - Tap **Apply with PESO Referral**. *Shown:* "Application sent to TechCorp … as PESO-Referred".
   - My Applications: the card shows **PESO-Referred / For Review**.
3. **Employer receives and updates** (TC-A-15, A-16)
   - Log in as hr@techcorp.ph. Alerts shows *New PESO-Referred Applicant*.
   - Manage Jobs, Junior Software Developer, Applicants (or the **Applicants** tab, then tap Junior Software Developer). Juan appears with his NSRP summary and matched/missing skills.
   - Set **For Interview**.
4. **Seeker sees the update**
   - As Juan: Alerts shows *Application Status Updated*.
   - My Applications, tap the card. The timeline shows "Sent to employer as PESO-Referred" then "Employer: For Interview".
5. **Admin monitors** (TC-A-25, A-26)
   - As admin: **Referrals**, **By Job**. Junior Software Developer shows *1 For Interview*.
   - Tap it to drill down to Juan's record and history.

## Recording 2: Objective (b). NSRP form, OCR, rule-based skill matching (about 6 min)

1. **NSRP Form 1 layout** (TC-B-01)
   - Log in as Pedro and open Profile.
   - Show **PESO Verification: Needs Revision** with the PESO note.
   - Scroll sections I-VIII:
     - civil status options including Live-in
     - disability checklist
     - employment type options
     - occupation 1-4
     - language grid
     - education rows per level
     - training / eligibility / work rows
     - other-skills checklist
2. **OCR** (TC-B-06, B-07, B-09)
   - Tap **Use OCR Assistant**, then **Gallery**, and pick `nsrp-page-2-sample.jpg`. Then **Scan and Pre-fill** (about 1 minute).
   - Scroll to show the education, training, and work rows and the ticked *Computer Literate* / *Photography* filled by OCR.
   - Scroll up to show Pedro's page-1 data is still there.
   - Say: "OCR only pre-fills. Nothing is saved until I review and tap **Confirm and Save**."
   - Copy the sample images to the phone first, for example into the Pictures folder.
3. **Fix and resubmit** (TC-A-09, A-06)
   - Back in Profile: add the SSS number in section I and the training dates in section V.
   - Tick the **certification** statement, then tap **Save and Resubmit to PESO**.
   - *Shown:* "Sent to PESO".
4. **Rule-based skill comparison** (TC-B-11, A-13)
   - Log in as Ana and open **Food Kiosk Cook**: 3/3 matched, "Meets the minimum", Apply button shown.
   - Open **Junior Software Developer**: 0/4 matched, the missing skills listed, "You need at least 3 of this job's required skills ...", and **Update My Skills** instead of Apply.
   - Say: "This is a plain matched/missing list. No score, no ranking."
5. **Admin compares with the uploaded form** (TC-B-14)
   - As admin: NSRP tab, Pedro, **Show Uploaded Form**. The scanned image appears next to the encoded data.

---

## What-if recordings

### W1: Many applicants, one hired; the others are not auto-rejected (TC-A-17)

1. As Maria: in Profile, Skills, add **Cooking**, **Food and Beverage Service**, **Teamwork**, then Save.
   - *Shown:* "Your NSRP profile changed, so it was sent back to PESO for re-checking."
2. As admin: NSRP, Maria, **Verify**.
3. As Maria: apply to **Food Kiosk Cook**. As Ana: apply to **Food Kiosk Cook**.
4. As hr@northstar.ph: Food Kiosk Cook, Applicants. Two PESO-referred applicants. Set Ana to **Hired**.
5. *Shown:* Maria is still **For Review**, and Maria received **no rejection** notice.
   - Say: "The system never rejects anyone automatically. Hiring decisions stay with the employer."
6. To show the vacancies notice, first edit the job and set Vacancies to 1.
   - *Shown:* after hiring Ana, the employer gets **All Vacancies Filled**.

### W2: The employer closes the job after hiring (TC-A-18)

1. Continue from W1. As hr@northstar.ph: Manage Jobs, **Close** Food Kiosk Cook.
2. As Maria: Alerts shows *Application Closed*: "… This is not a rejection; you may apply to other jobs." My Applications shows **Closed**.
3. As Ana: still **Hired**.

### W3: The employer edits a job after people applied (TC-A-19)

- As hr@techcorp.ph: edit IT Support Staff (for example the salary).
- As Maria: Alerts shows *Job Post Updated*.

### W4: A verified job seeker changes the profile (TC-A-14)

- As Ana: Profile, change Religion or add a skill, then Save.
- *Shown:* "Your NSRP profile changed, so it was sent back to PESO for re-checking." Home shows **NSRP: Submitted**.
- Opening a job shows **Submitted**: "Your NSRP profile was sent to PESO Misamis Oriental and is waiting to be checked." instead of Apply. Earlier applications are unaffected.
- As admin: the profile is back under **Needs Action**. The earlier "For use of PESO only" ticks are pre-filled, so tap **Verify** to keep them.

### W5: Admin deactivates an employer (TC-A-21)

1. As admin: Employers, Northstar, **Deactivate**. *Shown:* "4 active job post(s) were closed."
2. As a seeker: Jobs no longer lists Northstar jobs.
3. Logging in as hr@northstar.ph is refused.
4. Admin, **Reactivate**: the employer can sign in again; the old posts stay closed.

### W6: Admin deactivates a job seeker with an application (TC-A-20)

1. As admin: NSRP, Maria, **Deactivate Account**.
2. Maria's app is signed out on its next request.
3. TechCorp's Alerts show *Applicant Record Closed*.
4. Reactivate: Maria can sign in again.

### W7: Applying to a closed or expired job, applying twice, no skills (TC-A-05, A-12, B-12)

- Applying twice is impossible: after applying, the job page shows "Your Application" instead of the Apply button.
- Job closed or past its closing date: it disappears from Jobs; an open job page shows **Not Accepting Applications**.
- Seeker with no saved skills: the skill comparison says "Save your skills in your NSRP profile to see which of this job's ... required skills you have.", lists the required skills, and shows **Add My Skills**.

### W8: Employer account approval (TC-A-23)

- As admin: Employers, **Pending Approval**, Blue Mountain Resort, then **Approve**, then **Approve** again in the dialog.
- *Shown:* Pending Approval (0), Active (4). The employer can now sign in and post jobs.

### W9: OCR as the form's owner (TC-B-06, B-07, B-09)

The OCR samples belong to **Juan Dela Cruz Santos**, not to a seeded account. Register him first (Sign Up, any email), then:

1. Profile, **Use OCR Assistant**, Gallery, page 1, **Scan and Pre-fill** (about 1 minute), OK.
2. Gallery, page 2 (check the preview shows page 2), **Scan and Pre-fill**, OK. Both pages are now in one review.
3. Scroll the review: every field matches the paper, NA items are blank, and the ticks (Male, Single, Unemployed / New Entrant, Local, the language grid, Computer Literate, Photography) are set.
4. **Confirm and Save**. Back in Profile: *19/19 required items complete*.
5. Pick skills (for example Web Development, JavaScript, Database Management), tick the certification, **Save and Submit to PESO**.
6. Admin verifies him; he applies to Junior Software Developer (3/4 matched).
