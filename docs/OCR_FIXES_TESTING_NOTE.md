# Trying the OCR on branch `ocr-fixes` (optional)

Keep recording on `main` as usual. `ocr-fixes` is a separate branch; switching back to `main` puts everything back.
Use only the demo/test data below. Never scan a real person's form, and never run `npm run init-db`.

## 1. Get the branch (Command Prompt, in the project folder)
```
git fetch
git switch ocr-fixes
cd backend && npm.cmd install && cd ..
cd frontend && npm.cmd install && cd ..
```

## 2. One-time MySQL setting (needed for phone photos)
Open `C:\Program Files\Ampps\mysql\my.ini` as Administrator. Under `[mysqld]`, change
`max_allowed_packet = 1M` to `max_allowed_packet = 32M`, save, and restart MySQL in AMPPS.
(Without this, scanning a phone photo loads forever.)

## 3. Test database and server (keeps the demo database untouched)
Command Prompt 1, in `backend`:
```
set DEMO_DB=peso_link_test
npm.cmd run reset-demo
set DB_HOST=127.0.0.1
set DB_NAME=peso_link_test
set PORT=8002
node server.js
```

## 4. The app on your phone
Find your laptop's IP: run `ipconfig` and look for `IPv4 Address` (for example 192.168.1.23).
The phone must be on the **same Wi-Fi**. Command Prompt 2, in `frontend` (replace the IP):
```
set REACT_NATIVE_PACKAGER_HOSTNAME=192.168.1.23
set EXPO_PUBLIC_BACKEND_URL=http://192.168.1.23:8002
npx expo start --lan
```
Scan the QR code with **Expo Go**. Tap **Sign Up** and create a test job seeker (any made-up email).
If the phone can't connect, allow Node.js through Windows Firewall (Private networks).

## 5. Fill in a printed form, then scan
Print a blank NSRP Form 1 (both pages) and copy **one person** from `docs/OCR_HANDWRITING_FILL_IN_SHEET.md` onto it
**by hand** (ball pen, block letters). The people are fictional and have IDs **r01, r02, r03**; use a different person per writer.

Then scan:
Profile → **Fill from a scanned NSRP form** → Camera (or Gallery) → **Scan and Pre-fill**.
One page per photo, form flat, good light, whole page in view. Check the amber "Please check" hints,
fix any field, then **Confirm and Save** if you like (test data only).

## 6. Send the photos to Joeremy
Send the **original photos as files** (Messenger "send as file", Google Drive, or USB), not screenshots,
and say which person and page it is (for example "r01 page 1"). Joeremy scores them against the answer keys.

## Back to normal
```
git switch main
```
Then run the demo backend as usual (`cd backend && npm start`) and do `npm.cmd run reset-demo` before recordings.
