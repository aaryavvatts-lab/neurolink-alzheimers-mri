"""ImageNet-pretrained backbones with a CAM-compatible head.

Every architecture here ends in global average pooling -> single Linear. That is
deliberate and load-bearing: it means Class Activation Mapping is just

    cam[c] = sum_k  W[c, k] * featuremap[k]

a weighted sum with NO backward pass. Grad-CAM would need gradients, which
onnxruntime-web cannot compute -- so this choice is what allows the live site to
render an honest attention map entirely in the visitor's browser, using the same
maths as the Python analysis.
"""

from __future__ import annotations

import torch
import torch.nn as nn
import torchvision.models as tvm


class CAMNet(nn.Module):
    """Backbone -> feature map -> GAP -> Linear, exposing the feature map."""

    def __init__(self, arch: str = "resnet18", n_classes: int = 4, pretrained: bool = True):
        super().__init__()
        self.arch = arch
        if arch == "resnet18":
            m = tvm.resnet18(weights=tvm.ResNet18_Weights.IMAGENET1K_V1 if pretrained else None)
            self.features = nn.Sequential(*list(m.children())[:-2])
            n_feat = m.fc.in_features
        elif arch == "resnet34":
            m = tvm.resnet34(weights=tvm.ResNet34_Weights.IMAGENET1K_V1 if pretrained else None)
            self.features = nn.Sequential(*list(m.children())[:-2])
            n_feat = m.fc.in_features
        elif arch == "efficientnet_b0":
            m = tvm.efficientnet_b0(
                weights=tvm.EfficientNet_B0_Weights.IMAGENET1K_V1 if pretrained else None)
            self.features = m.features
            n_feat = m.classifier[-1].in_features
        else:
            raise ValueError(f"unknown arch: {arch}")

        self.pool = nn.AdaptiveAvgPool2d(1)
        self.dropout = nn.Dropout(0.2)
        self.fc = nn.Linear(n_feat, n_classes)
        self.n_feat = n_feat

    def forward(self, x: torch.Tensor, return_features: bool = False):
        f = self.features(x)
        z = self.pool(f).flatten(1)
        logits = self.fc(self.dropout(z))
        return (logits, f) if return_features else logits

    def cam(self, x: torch.Tensor) -> torch.Tensor:
        """Class activation maps, (B, n_classes, h, w). No gradients required."""
        _, f = self.forward(x, return_features=True)
        return torch.einsum("bchw,kc->bkhw", f, self.fc.weight)


def build_model(name: str, n_classes: int = 4, pretrained: bool = True) -> nn.Module:
    if name == "scratch_cnn":
        from .scratch_cnn import ScratchCNN
        return ScratchCNN(n_classes=n_classes)
    return CAMNet(arch=name, n_classes=n_classes, pretrained=pretrained)
