"""A small CNN trained from scratch -- the architecture the reel actually asks for.

Kept as a control: it answers "does ImageNet pretraining matter on brain MRI?",
a question worth an honest answer rather than an assumption. Like the transfer
models it ends in global average pooling followed by a single linear layer, so
Class Activation Mapping works on it too.
"""

from __future__ import annotations

import torch
import torch.nn as nn


def block(cin: int, cout: int) -> nn.Sequential:
    return nn.Sequential(
        nn.Conv2d(cin, cout, 3, padding=1, bias=False),
        nn.BatchNorm2d(cout),
        nn.ReLU(inplace=True),
        nn.Conv2d(cout, cout, 3, padding=1, bias=False),
        nn.BatchNorm2d(cout),
        nn.ReLU(inplace=True),
        nn.MaxPool2d(2),
    )


class ScratchCNN(nn.Module):
    def __init__(self, n_classes: int = 4, in_ch: int = 3, width: int = 32):
        super().__init__()
        w = width
        self.features = nn.Sequential(
            block(in_ch, w), block(w, w * 2), block(w * 2, w * 4),
            block(w * 4, w * 8), block(w * 8, w * 8),
        )
        self.pool = nn.AdaptiveAvgPool2d(1)
        self.dropout = nn.Dropout(0.3)
        self.fc = nn.Linear(w * 8, n_classes)

    def forward(self, x: torch.Tensor, return_features: bool = False):
        f = self.features(x)                     # (B, C, h, w)
        z = self.pool(f).flatten(1)
        logits = self.fc(self.dropout(z))
        return (logits, f) if return_features else logits
