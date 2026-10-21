# OCR setup on `main` (for the team)

The NSRP scan reads every box with **Tesseract.js**. A second reader, **PaddleOCR**, reads handwriting much better.
PaddleOCR runs on your own computer (no account, no internet once installed, no form data sent anywhere).
Without it the scan still works, with Tesseract only.

## Once per computer

1. **Python 3.10 to 3.13** from https://www.python.org/downloads/ (tick **"Add python.exe to PATH"** when installing).
2. Get the latest `main` and install (Command Prompt, project folder):
   ```
   git switch main
   git pull
   cd backend && npm.cmd install && cd ..
   cd frontend && npm.cmd install && cd ..
   ```
3. Install PaddleOCR (a few hundred MB, a few minutes):
   ```
   cd backend
   npm.cmd run ocr:setup
   ```
4. Phone photos are large: open `C:\Program Files\Ampps\mysql\my.ini` as Administrator, under `[mysqld]` set
   `max_allowed_packet = 32M`, save, and restart MySQL in AMPPS. (Without this, a phone photo loads forever.)

## Every time

Start the backend as usual (`npm.cmd start` in `backend`). It now also starts PaddleOCR. The console shows:

```
[OCR] Second reader (PaddleOCR) starting on 127.0.0.1:8765 ...
[OCR helper] OCR helper (en_PP-OCRv5_mobile_rec) on http://127.0.0.1:8765
```

The very first start downloads the reading model once (internet needed). If you see
`[OCR] Second reader (PaddleOCR) not set up`, run step 3.

## Good to know

- Review hints (amber "Check:" notes) show the fields to compare with the paper. A field without a hint can still be wrong:
  the person always checks every field before saving.
- Scanned salaries are written as `₱12,000 - ₱15,000`.
- Use made-up test data only. Never scan a real person's form, and never run `npm run init-db`.
- Details for servers: `backend/ocr-helper/README.md`.
