"""
PaddleOCR helper for the NSRP scan (second reader for handwritten answers; see backend/services/ocrHelper.js).

POST /read  {"images": [base64 image, ...]}  ->  {"texts": [...], "scores": [...]}
GET  /health                                 ->  {"ok": true, "model": "..."}

Each image is one answer box already cut out and cleaned by the backend. Only text recognition runs here (no
layout detection), on this machine; nothing is sent anywhere else.

Run:  python server.py            (listens on 127.0.0.1:8765; set OCR_HELPER_PORT / OCR_HELPER_MODEL to change)
Then set OCR_HELPER_URL=http://127.0.0.1:8765 in backend/.env and restart the backend.
"""
import base64, io, json, os, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

os.environ.setdefault('PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK', 'True')
import numpy as np
from PIL import Image, ImageOps
from paddleocr import TextRecognition

PORT = int(os.environ.get('OCR_HELPER_PORT', '8765'))
MODEL = os.environ.get('OCR_HELPER_MODEL', 'en_PP-OCRv5_mobile_rec')
THREADS = int(os.environ.get('OCR_HELPER_THREADS', str(max(1, (os.cpu_count() or 2)))))
MAX_IMAGES = 400

model = TextRecognition(model_name=MODEL, device='cpu', cpu_threads=THREADS)
lock = threading.Lock()  # one recognition at a time (the model is not shared safely between threads)


def prepare(data):
    """Decode one box image and crop it to the writing plus a small margin (the model expects a text line).
    An image that cannot be opened is skipped (empty reading), so one bad box never fails the whole page."""
    try:
        img = Image.open(io.BytesIO(base64.b64decode(data))).convert('L')
    except Exception:
        return None
    box = ImageOps.invert(img).point(lambda v: 255 if v > 60 else 0).getbbox()
    if not box:
        return None
    img = img.crop((max(0, box[0] - 12), max(0, box[1] - 12), min(img.width, box[2] + 12), min(img.height, box[3] + 12)))
    return np.array(img.convert('RGB'))[:, :, ::-1]  # BGR, as the model expects


class Handler(BaseHTTPRequestHandler):
    def send_json(self, code, body):
        raw = json.dumps(body).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        if self.path == '/health':
            self.send_json(200, {'ok': True, 'model': MODEL})
        else:
            self.send_json(404, {'error': 'not found'})

    def do_POST(self):
        if self.path != '/read':
            return self.send_json(404, {'error': 'not found'})
        try:
            length = int(self.headers.get('Content-Length') or 0)
            images = json.loads(self.rfile.read(length) or b'{}').get('images') or []
            if not isinstance(images, list) or len(images) > MAX_IMAGES:
                return self.send_json(400, {'error': 'images must be a list of at most %d items' % MAX_IMAGES})
            prepared = [prepare(x) for x in images]
            todo = [i for i, p in enumerate(prepared) if p is not None]
            texts, scores = [''] * len(images), [0.0] * len(images)
            t0 = time.time()
            with lock:
                results = model.predict(input=[prepared[i] for i in todo], batch_size=8) if todo else []
            for i, r in zip(todo, results):
                texts[i] = str(r['rec_text']).strip()
                scores[i] = round(float(r['rec_score']), 3)
            self.send_json(200, {'texts': texts, 'scores': scores, 'seconds': round(time.time() - t0, 2)})
        except Exception as err:  # bad input: the backend then keeps Tesseract's readings
            self.send_json(400, {'error': str(err)})

    def log_message(self, fmt, *args):
        pass


if __name__ == '__main__':
    print(f'OCR helper ({MODEL}) on http://127.0.0.1:{PORT}', flush=True)
    ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
