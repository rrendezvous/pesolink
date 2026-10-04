# PESO-Link MisOr Startup And Login Walkthrough

This guide is written for the local folder:

```powershell
C:\Users\user\Downloads\pes-main\pes-main
```

Use two terminals:

- Terminal 1: backend API
- Terminal 2: frontend Expo app

Do not close either terminal while using the app.

## 1. Start MySQL

Before starting the project, make sure MySQL is running.

If you use Laragon:

1. Open Laragon.
2. Click **Start All**.
3. Make sure MySQL is running.

The current backend settings are in:

```text
backend\.env
```

Current expected values:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=mysql
DB_NAME=peso_link_misor
PORT=8001
JWT_SECRET=peso_link_misor_secret
JWT_EXPIRES_IN=7d
```

## 2. First-Time Setup Only

Run this only if the database has not been initialized yet, or if you want to reset the demo data.

Important: `node init-db.js` drops and recreates the app tables in `peso_link_misor` (the real database name is fixed in `schema.sql`). It will remove existing app data. For a separate demo database, run `npm run reset-demo` instead (only touches `peso_link_demo`).

Open **PowerShell Terminal 1**, then copy and paste:

```powershell
cd C:\Users\user\Downloads\pes-main\pes-main\backend
npm.cmd install
node init-db.js
node seed.js
```

Expected seed accounts:

```text
Admin:        admin@peso.gov.ph / Admin@123
Job Seeker 1: juan.cruz@example.com / Test@123     (NSRP submitted, waiting for PESO)
Job Seeker 2: maria.santos@example.com / Test@123  (PESO-verified, applied to IT Support)
Job Seeker 3: pedro.reyes@example.com / Test@123   (NSRP needs revision)
Job Seeker 4: ana.bautista@example.com / Test@123  (PESO-verified, no applications yet)
Employer 1:   hr@techcorp.ph / Test@123
Employer 2:   hr@northstar.ph / Test@123
Employer 3:   hr@bluemountain.ph / Test@123
```

Open **PowerShell Terminal 2**, then copy and paste:

```powershell
cd C:\Users\user\Downloads\pes-main\pes-main\frontend
npm.cmd install
```

## 3. Normal Startup

Use these steps every time you want to run the system.

### Terminal 1: Start The Backend

Open **PowerShell Terminal 1**, then copy and paste:

```powershell
cd C:\Users\user\Downloads\pes-main\pes-main\backend
npm.cmd start
```

Expected output:

```text
[Server] PESO-Link MisOr backend running on http://0.0.0.0:8001
[Server] Health: http://localhost:8001/api/health
[DB] Connected to MySQL database: peso_link_misor
```

Leave this terminal open.

### Backend Health Check

Open this link in your browser:

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

## 4. Start The Frontend

Choose only one option below.

Use **Option A** if you are using an Android emulator on the same computer.

Use **Option B** if you are using Expo Go on a physical Android phone.

## Option A: Android Emulator

Make sure your Android emulator is already open.

Open **PowerShell Terminal 2**, then copy and paste:

```powershell
cd C:\Users\user\Downloads\pes-main\pes-main\frontend
$env:EXPO_PUBLIC_BACKEND_URL="http://localhost:8001"
npm.cmd run android
```

Wait for Expo to finish loading. The app should open in the emulator.

## Option B: Physical Android Phone With Expo Go

Your phone and laptop must be connected to the same Wi-Fi network.

### Step B1: Find Your Laptop IP Address

Open **PowerShell Terminal 2**, then copy and paste:

```powershell
ipconfig
```

Look for the active Wi-Fi adapter and copy the `IPv4 Address`.

Example:

```text
IPv4 Address . . . . . . . . . . . : 192.168.18.71
```

In the next command, replace `192.168.18.71` with your own IPv4 address.

### Step B2: Start Expo For Phone

In **PowerShell Terminal 2**, copy and paste this, but replace the IP address first:

```powershell
cd C:\Users\user\Downloads\pes-main\pes-main\frontend
$env:REACT_NATIVE_PACKAGER_HOSTNAME="192.168.18.71"
$env:EXPO_PUBLIC_BACKEND_URL="http://192.168.18.71:8001"
npx.cmd expo start --lan -c
```

Expo should show a QR code.

Good Expo URL for a physical phone:

```text
exp://192.168.x.x:8081
```

Bad Expo URL for a physical phone:

```text
exp://127.0.0.1:8081
exp://localhost:8081
```

### Step B3: Open The App On Your Phone

1. Open **Expo Go** on your Android phone.
2. Scan the QR code from Terminal 2.
3. Wait for the app to load.
4. Keep Terminal 1 and Terminal 2 open.

## 5. Login Accounts

Use these on the app login screen.

### PESO Admin Login

```text
Email: admin@peso.gov.ph
Password: Admin@123
```

Use this account to show:

- Dashboard statistics
- Employer management
- Job seeker management
- NSRP verification (once per job seeker)
- Job monitoring
- Application monitoring

### Job Seeker Login

```text
Email: juan.cruz@example.com
Password: Test@123
```

Use this account to show:

- Job seeker dashboard
- NSRP profile
- Upload NSRP OCR
- Browse jobs
- Skill match and missing skills
- My Applications
- Notifications

Other job seeker accounts:

```text
maria.santos@example.com / Test@123
pedro.reyes@example.com / Test@123
```

### Approved Employer Login

```text
Email: hr@techcorp.ph
Password: Test@123
```

Use this account to show:

- Employer dashboard
- Manage jobs
- Create or edit job posts
- View PESO-referred applicants
- Update application status
- Notifications

Other approved employer:

```text
hr@northstar.ph / Test@123
```

### Pending Employer Login

```text
Email: hr@bluemountain.ph
Password: Test@123
```

Use this only if you want to show that a pending employer cannot post jobs yet.

## 6. Suggested Demo Walkthrough

### Admin Demo

1. Log in as:

```text
admin@peso.gov.ph
Admin@123
```

2. Open the admin dashboard.
3. Show the dashboard statistics.
4. Open employer management.
5. Show approved and pending employer accounts.
6. Open job seeker management.
7. Open a job seeker's NSRP profile (monitoring view).
8. Open NSRP and tap a profile under Needs Action (it becomes For Review automatically).
9. Check the NSRP profile, then Verify it or Return for Revision with a note.
10. Open job monitoring.
11. Show that jobs can be soft-closed.

### Job Seeker Demo

1. Log in as:

```text
juan.cruz@example.com
Test@123
```

2. Open the job seeker dashboard.
3. Open the profile screen.
4. Show the NSRP/profile fields.
5. Open Upload NSRP.
6. Use the sample OCR images from:

```text
C:\Users\user\Downloads\pes-main\pes-main\samples\nsrp-ocr
```

Use:

```text
nsrp-page-1-sample.jpg
nsrp-page-2-sample.jpg
```

7. Show that OCR results are editable before saving.
8. Open jobs.
9. Search for a job, for example:

```text
developer
```

10. Open a job detail page.
11. Show matched skills and missing required skills.
12. Tap Apply with PESO Referral (needs a PESO-verified NSRP profile and at least 3 matching skills).
    Juan can apply only after the admin demo verifies him. Saving OCR or profile changes on a verified
    profile sends it back to PESO, so to show one-tap applying without re-verifying, log in as
    ana.bautista@example.com and apply to Food Kiosk Cook.
13. Open My Applications.
14. Open Notifications.

### Employer Demo

1. Log in as:

```text
hr@techcorp.ph
Test@123
```

2. Open the employer dashboard.
3. Open manage jobs.
4. Create a sample job post.
5. Add requirements and application instructions.
6. Select required skills.
7. Open applicants for a job.
8. View an applicant profile summary.
9. Show matched and missing skills.
10. Update the application status.
11. Open Notifications.

## 7. If Login Fails

First, check that Terminal 1 still shows the backend running.

Then open this in your browser:

```text
http://localhost:8001/api/health
```

If health check fails, restart the backend:

```powershell
cd C:\Users\user\Downloads\pes-main\pes-main\backend
npm.cmd start
```

If the account does not exist or the password does not work, reset the database.

Warning: this deletes the current app data and restores demo data.

```powershell
cd C:\Users\user\Downloads\pes-main\pes-main\backend
node init-db.js
node seed.js
npm.cmd start
```

## 8. If The Phone App Cannot Connect

Make sure:

- Phone and laptop are on the same Wi-Fi.
- Backend is running in Terminal 1.
- The backend URL uses the laptop IP, not `localhost`.
- Expo URL starts with `exp://192.168...`, not `exp://localhost`.

Restart Expo with your laptop IP:

```powershell
cd C:\Users\user\Downloads\pes-main\pes-main\frontend
$env:REACT_NATIVE_PACKAGER_HOSTNAME="192.168.18.71"
$env:EXPO_PUBLIC_BACKEND_URL="http://192.168.18.71:8001"
npx.cmd expo start --lan -c
```

Replace `192.168.18.71` with your real IPv4 address.

If LAN mode still fails, try tunnel mode:

```powershell
cd C:\Users\user\Downloads\pes-main\pes-main\frontend
$env:EXPO_PUBLIC_BACKEND_URL="http://192.168.18.71:8001"
npx.cmd expo start --tunnel -c
```

Replace `192.168.18.71` with your real IPv4 address.

## 9. If PowerShell Blocks npm

If you see an error like:

```text
npm.ps1 cannot be loaded because running scripts is disabled on this system
```

Use `npm.cmd` instead of `npm`.

Examples:

```powershell
npm.cmd install
npm.cmd start
npm.cmd run android
npm.cmd run lint
```

## 10. Quick Copy-Paste Version

Use this after the database has already been initialized and seeded.

### Terminal 1

```powershell
cd C:\Users\user\Downloads\pes-main\pes-main\backend
npm.cmd start
```

### Terminal 2 For Android Emulator

```powershell
cd C:\Users\user\Downloads\pes-main\pes-main\frontend
$env:EXPO_PUBLIC_BACKEND_URL="http://localhost:8001"
npm.cmd run android
```

### Terminal 2 For Physical Phone

Replace `192.168.18.71` with your laptop IPv4 address.

```powershell
cd C:\Users\user\Downloads\pes-main\pes-main\frontend
$env:REACT_NATIVE_PACKAGER_HOSTNAME="192.168.18.71"
$env:EXPO_PUBLIC_BACKEND_URL="http://192.168.18.71:8001"
npx.cmd expo start --lan -c
```

### Login

```text
Admin:
admin@peso.gov.ph
Admin@123

Job seeker:
juan.cruz@example.com
Test@123

Employer:
hr@techcorp.ph
Test@123
```
