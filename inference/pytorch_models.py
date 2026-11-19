"""Checkpoint architecture reconstructed from the supplied training notebook and tensor keys.

Research use only. Do not use these single-slice categories for clinical staging.
"""
from pathlib import Path
import torch
from torch import nn
from torchvision.models import efficientnet_b0

class AlzheimerEfficientNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.EfficientNet_backbone = efficientnet_b0(weights=None)
        self.fc = nn.Sequential(
            nn.Linear(1000, 1024), nn.BatchNorm1d(1024), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(1024, 512), nn.BatchNorm1d(512), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(512, 256), nn.BatchNorm1d(256), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(256, 4)
        )

    def forward(self, x):
        return self.fc(self.EfficientNet_backbone(x))


def load_efficientnet_checkpoint(path):
    """Only load trusted checkpoint bytes; weights_only blocks most pickle objects."""
    checkpoint = torch.load(str(Path(path)), map_location='cpu', weights_only=True)
    state = checkpoint['net'] if isinstance(checkpoint, dict) and 'net' in checkpoint else checkpoint
    model = AlzheimerEfficientNet()
    model.load_state_dict(state, strict=True)
    model.eval()
    return model
