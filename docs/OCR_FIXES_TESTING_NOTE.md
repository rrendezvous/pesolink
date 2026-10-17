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

## 5. Make your forms (at least 1 handwritten and 1 digital), with made-up details only
Never use your own or anyone's real name, ID numbers, address or phone. Write NA where nothing applies.
- **Handwritten:** print a blank NSRP Form 1 and fill it in by hand (ball pen, block letters). Photograph it with the
  app's **Camera**.
- **Digital:** fill the form on the computer, then save **each page as an image** (PNG or JPG; the app does not read PDFs),
  copy the images to your phone and pick them with the app's **Gallery**. Keep the original digital file (PDF) too.
(If you'd rather copy ready-made fictional people, use `docs/OCR_HANDWRITING_FILL_IN_SHEET.md`.)

**Use a new test account for each form** (Sign Up again with another made-up email): the export below reads the
account's saved profile, so a second form on the same account would overwrite the first one's answers.

## 6. Scan, then correct and save
1. Profile → **Fill from a scanned NSRP form** → Camera → **Scan and Pre-fill** (one page per photo: page 1, then page 2;
   form flat, good light, whole page in view).
2. **Don't fix anything yet - first take a screenshot of the review screen** if you want to keep what the OCR read.
3. Now go through **every field** and correct it so it matches your paper exactly (the amber hints show the likely mistakes,
   but check all fields). Then press **Confirm and Save**.

## 7. Export the result and send it
Command Prompt 3, in `backend` (use the email of your test account):
```
set DB_HOST=127.0.0.1
set DB_NAME=peso_link_test
node scripts/ocr-export-review.js yourtest@example.com
```
This writes `ocr-review-<email>.json` (what the OCR read next to what you saved). Do this **once per form/account**.
Send Joeremy, for each form: **that file, the original photos or page images as files** (Messenger "send as file",
Google Drive, or USB - not screenshots), and for digital forms **the original digital file (PDF)**. Say which is which
(for example "handwritten, account a@example.com" / "digital, account b@example.com").

## Back to normal
```
git switch main
```
Then run the demo backend as usual (`cd backend && npm start`) and do `npm.cmd run reset-demo` before recordings.
