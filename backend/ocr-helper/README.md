# OCR helper (optional second reader for handwriting)

The NSRP scan reads every answer box with Tesseract.js. When this helper is running, boxes with writing are also
read by PaddleOCR (PP-OCRv5 English text recognition), which reads handwriting much better. When the two readings
differ, the review screen asks the person to check that field.

The helper is **optional**: without it (or if it stops), the scan works exactly as before with Tesseract only.
Everything runs on the same machine as the backend; no form data is sent to any outside service.

## Setup (once)

Needs Python 3.10–3.13. From `backend`:

```bash
npm run ocr:setup        # makes ocr-helper/.venv and installs PaddleOCR
```

The first start downloads the recognition model (a few MB) into the user's `.paddlex` folder.

## Run

`npm start` starts the helper automatically when it is set up (and `OCR_HELPER_URL` is not set), on 127.0.0.1:8765.
To run it by itself instead: `npm run ocr:helper`, then set `OCR_HELPER_URL=http://127.0.0.1:8765` in `backend/.env`.

Optional settings: `OCR_HELPER_PORT` (default 8765), `OCR_HELPER_MODEL` (default `en_PP-OCRv5_mobile_rec`),
`OCR_HELPER_THREADS` (default: all CPU cores), and in the backend `OCR_HELPER_TIMEOUT_MS` (default 30000) and
`OCR_HELPER_AUTO=off` (do not start the helper with the backend).

Check: `curl http://127.0.0.1:8765/health` → `{"ok": true, ...}`.

## Server (e.g. DigitalOcean, Ubuntu)

Run it next to the backend as its own service (systemd or pm2) listening on 127.0.0.1 only (not opened to the
internet), and set `OCR_HELPER_URL=http://127.0.0.1:8765` for the backend. About 1 GB of memory is enough;
a 2 GB droplet runs the backend, MySQL and this helper.
