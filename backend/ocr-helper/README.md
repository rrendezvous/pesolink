# OCR helper (optional second reader for handwriting)

The NSRP scan reads every answer box with Tesseract.js. When this helper is running, boxes with writing are also
read by PaddleOCR (PP-OCRv5 English text recognition), which reads handwriting much better. When the two readings
differ, the review screen asks the person to check that field.

The helper is **optional**: without it (or if it stops), the scan works exactly as before with Tesseract only.
Everything runs on the same machine as the backend; no form data is sent to any outside service.

## Setup (once)

Needs Python 3.10–3.13.

```bash
cd backend/ocr-helper
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt      # Linux / DigitalOcean: .venv/bin/python
```

The first start downloads the recognition model (a few MB) into the user's `.paddlex` folder.

## Run

```bash
.venv/Scripts/python server.py        # listens on 127.0.0.1:8765
```

Then add to `backend/.env` and restart the backend:

```
OCR_HELPER_URL=http://127.0.0.1:8765
```

Optional settings: `OCR_HELPER_PORT` (default 8765), `OCR_HELPER_MODEL` (default `en_PP-OCRv5_mobile_rec`),
`OCR_HELPER_THREADS` (default: all CPU cores), and in the backend `OCR_HELPER_TIMEOUT_MS` (default 30000).

Check: `curl http://127.0.0.1:8765/health` → `{"ok": true, ...}`.

## Server (e.g. DigitalOcean, Ubuntu)

Run it next to the backend as a service (systemd or pm2), listening on 127.0.0.1 only (not opened to the internet).
About 1 GB of memory is enough; a 2 GB droplet runs the backend, MySQL and this helper.
