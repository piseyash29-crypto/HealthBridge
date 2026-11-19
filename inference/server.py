"""Local MRI research inference service supporting verified PyTorch and ONNX checkpoints."""
import io, json, os, hmac, hashlib, warnings
from pathlib import Path
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from email.parser import BytesParser
from email.policy import default

ROOT = Path(__file__).resolve().parent
CONFIG = Path(os.environ.get('MRI_MANIFEST', str(ROOT / 'models.json')))
TOKEN = os.environ.get('MRI_API_TOKEN', '')
SESSIONS = {}
PYTORCH_MODELS = {}

def manifest():
    if not CONFIG.exists():
        return []
    entries = json.loads(CONFIG.read_text())['models']
    if not isinstance(entries, list):
        raise ValueError('Invalid model manifest')
    return entries

def ready(m):
    return bool(m.get('purpose') != 'pretrained_backbone_only' and m.get('preprocessing_confirmed') is True and m.get('labels') and (ROOT / m['file']).is_file())

def predict(m, content):
    import numpy as np
    from PIL import Image, ImageOps
    Image.MAX_IMAGE_PIXELS = 16000000
    with warnings.catch_warnings():
        warnings.simplefilter('error', Image.DecompressionBombWarning)
        image = Image.open(io.BytesIO(content))
        if image.format not in ('PNG', 'JPEG'):
            raise ValueError('PNG or JPEG MRI slice required')
        image.load()
        if min(image.size) < 32:
            raise ValueError('Image dimensions are too small')
        p = m['preprocessing']
        if p.get('exif_transpose', False):
            image = ImageOps.exif_transpose(image)
        image = image.convert(p['color_mode'])
        interpolation = {'nearest': Image.Resampling.NEAREST, 'bilinear': Image.Resampling.BILINEAR, 'bicubic': Image.Resampling.BICUBIC}[p['interpolation']]
        # Width, height in the manifest. No implicit ImageNet or Keras normalization.
        image = image.resize(tuple(p['size']), interpolation)
        arr = np.asarray(image, dtype=np.float32)
        if arr.ndim == 2:
            arr = arr[:, :, None]
        arr = arr * float(p['scale'])
        arr = (arr - np.asarray(p['mean'], dtype=np.float32)) / np.asarray(p['std'], dtype=np.float32)
        if p['layout'] == 'NCHW':
            arr = arr.transpose(2, 0, 1)
        elif p['layout'] != 'NHWC':
            raise ValueError('Invalid input layout')
        arr = arr[None].astype(np.float32)
    path = (ROOT / m['file']).resolve()
    key = (str(path), path.stat().st_mtime_ns)
    if m.get('format') == 'pytorch':
        import torch
        from pytorch_models import load_efficientnet_checkpoint
        if m['id'] != 'efficientnet_b0':
            raise ValueError('No verified PyTorch loader for this architecture')
        if key not in PYTORCH_MODELS:
            PYTORCH_MODELS.clear()
            PYTORCH_MODELS[key] = load_efficientnet_checkpoint(path)
        with torch.inference_mode():
            output = PYTORCH_MODELS[key](torch.from_numpy(arr))
        vector = output.detach().cpu().numpy().reshape(-1).astype(np.float64)
    else:
        import onnxruntime as ort
        if key not in SESSIONS:
            SESSIONS[key] = ort.InferenceSession(str(path), providers=['CPUExecutionProvider'])
        session = SESSIONS[key]
        vector = np.asarray(session.run(None, {session.get_inputs()[0].name: arr})[m.get('output_index', 0)]).reshape(-1).astype(np.float64)
    labels = m['labels']
    if len(vector) != len(labels) or len(labels) < 2 or len(set(labels)) != len(labels) or not np.isfinite(vector).all():
        raise ValueError('Model output does not match class labels')
    if m['output_type'] == 'logits':
        vector = np.exp(vector - vector.max())
        vector /= vector.sum()
    elif m['output_type'] != 'probabilities':
        raise ValueError('Specify logits or probabilities in manifest')
    if (vector < 0).any() or (vector > 1).any() or abs(float(vector.sum()) - 1) > .01:
        raise ValueError('Invalid model probabilities')
    return {'model': m['id'], 'version': m['version'], 'scope': m['scope'],
            'preprocessing': hashlib.sha256(json.dumps(p, sort_keys=True).encode()).hexdigest(),
            'scores': [{'label': label, 'probability': float(prob)} for label, prob in zip(labels, vector)]}

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass  # Do not log patient data or authentication headers.

    def send(self, status, value):
        data = json.dumps(value).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def authorized(self):
        return not TOKEN or hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + TOKEN)

    def do_GET(self):
        if not self.authorized():
            return self.send(401, {'error': 'Unauthorized'})
        if self.path != '/models':
            return self.send(404, {'error': 'Not found'})
        try:
            self.send(200, {'models': [{k: m.get(k) for k in ('id', 'name', 'version', 'scope', 'labels', 'purpose')} | {'ready': ready(m), 'checkpoint_present': (ROOT / m['file']).is_file()} for m in manifest()]})
        except Exception:
            self.send(503, {'error': 'Invalid or unavailable model configuration'})

    def do_POST(self):
        if not self.authorized():
            return self.send(401, {'error': 'Unauthorized'})
        if self.path != '/predict':
            return self.send(404, {'error': 'Not found'})
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 6 * 1024 * 1024:
                return self.send(413, {'error': 'Maximum request size is 6 MB'})
            raw = self.rfile.read(size)
            msg = BytesParser(policy=default).parsebytes(('Content-Type: ' + self.headers.get('Content-Type', '') + '\r\nMIME-Version: 1.0\r\n\r\n').encode() + raw)
            values = {part.get_param('name', header='content-disposition'): part.get_payload(decode=True) for part in msg.iter_parts()}
            model_id = values.get('model', b'').decode()
            m = next((m for m in manifest() if m['id'] == model_id), None)
            if not m or not ready(m):
                return self.send(503, {'error': 'Trained model and confirmed preprocessing required'})
            image = values.get('file', b'')
            if not image or len(image) > 5 * 1024 * 1024:
                return self.send(400, {'error': 'Valid image up to 5 MB required'})
            self.send(200, predict(m, image))
        except ImportError:
            self.send(503, {'error': 'Install inference requirements'})
        except Exception:
            self.send(422, {'error': 'Image or model configuration could not be processed'})

if __name__ == '__main__':
    host = os.environ.get('MRI_HOST', '127.0.0.1')
    if host not in ('127.0.0.1', 'localhost') and not TOKEN:
        raise SystemExit('MRI_API_TOKEN is required when binding beyond localhost')
    print('HealthBridge model service listening on port 8001', flush=True)
    ThreadingHTTPServer((host, int(os.environ.get('MRI_PORT', '8001'))), Handler).serve_forever()
