"""Verify model checkpoints without claiming clinical validity."""
import json
import re
from pathlib import Path
import torch
from torchvision.models import densenet121
from pytorch_models import load_efficientnet_checkpoint

ROOT = Path(__file__).resolve().parent
manifest = json.loads((ROOT / 'models.json').read_text())['models']
for m in manifest:
    p = ROOT / m['file']
    print(f"\n{m['name']}: {p.name}")
    if not p.is_file():
        print('  MISSING'); continue
    print(f'  File: {p.stat().st_size / 1024**2:.1f} MiB')
    try:
        if m['id'] == 'efficientnet_b0':
            model = load_efficientnet_checkpoint(p)
            print('  Loaded: 4-class research EfficientNet checkpoint')
            print('  Status: enabled for experimental inference')
        elif m['id'] == 'densenet121':
            state = torch.load(p, map_location='cpu', weights_only=True)
            model = densenet121(weights=None)
            # Original torchvision checkpoints use legacy keys like norm.1; translate to norm1.
            state = {re.sub(r"^(.*denselayer\d+\.(?:norm|relu|conv))\.(1|2)\.(weight|bias|running_mean|running_var)$", r"\1\2.\3", key): val for key, val in state.items()}
            model.load_state_dict(state, strict=True)
            model.eval()
            print(f'  Loaded: DenseNet121 classifier with {model.classifier.out_features} ImageNet outputs')
            print('  Status: pretrained backbone only; Alzheimer MRI prediction DISABLED')
    except Exception as exc:
        print(f'  LOAD ERROR: {type(exc).__name__}: {exc}')
        raise
