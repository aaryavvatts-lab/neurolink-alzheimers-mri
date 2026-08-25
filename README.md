# NeuroLink, Alzheimer's staging from brain MRI

A convolutional network that reads an axial brain MRI slice and predicts a Clinical Dementia
Rating stage, trained on OASIS-1. It ships as a static website where the model runs entirely in
the visitor's browser.

**The point of this repo is not the classifier.** It is the gap between how well the classifier
appears to work and how well it actually works, a gap created entirely by how the data is split.

> ⚠️ Research demonstration. Not a medical device, not validated for clinical use, and not fit to
> inform any decision about any real person.

**Live site:** https://neurolink-mri.vercel.app

## What the runs actually found

| Approach | 4-stage balanced accuracy | Dementia or not (AUC) |
|---|---|---|
| Split by slice, the usual way | 0.989 | 1.000 |
| Small CNN trained from scratch | **0.407** | **0.942** |
| ResNet-18 pretrained on photographs | 0.355 | 0.871 |
| Same network, brain erased | 0.376 | 0.827 |
| Eight measurements and a plain fit | 0.333 | 0.854 |

Three things worth reading twice:

1. Splitting by slice instead of by patient took balanced accuracy from 0.337 to
   0.989. Yagis and colleagues found about the same thing on this dataset in 2021.
2. Erasing the brain barely hurt. The best real model beats a brain-removed
   control by 0.031, so a good part of the apparent skill is riding on head size
   and skull shape, which track age, which drives dementia risk.
3. The small network beat the pretrained one on every measure, at a fifth of the
   size. Pretraining on photographs is usually assumed to help. Here it did not.

---

## The three things everyone gets wrong

**1. There are 347 patients, not 86,437 samples.**

| Stage | CDR | Images | **Patients** |
|---|---|---|---|
| Non Demented | 0 | 67,222 (77.8%) | 266 |
| Very mild Dementia | 0.5 | 13,725 (15.9%) | 58 |
| Mild Dementia | 1 | 5,002 (5.8%) | 21 |
| Moderate Dementia | 2 | 488 (0.6%) | **2** |

Each patient contributes ~244 images: 4 repeat scans × 61 adjacent axial slices. Slice 119 and
slice 120 of the same skull are nearly the same picture. A random train/test split puts them on
opposite sides of the boundary, and the network scores brilliantly by recognising the *person*.

Under a random slice split, **all 347 subjects appear in both train and test.** Not some, every
one. `src/neurolink/data/splits.py` contains a self-test that demonstrates this.

**2. Dice and IoU cannot validate a classifier.** They measure spatial overlap between a predicted
region and a true region. A four-way probability vector has no region. Computed on classification
output they silently degenerate into F1 and Jaccard. This repo reports the metrics the task
actually needs, balanced accuracy, macro-F1, quadratic weighted kappa, ROC-AUC, and computes
*genuine* Dice and IoU where they mean something: between the model's class activation map and an
anatomically derived ventricle mask, with null controls. See `src/neurolink/explain.py`.

**3. The images are 496×248**, a 248×248 slice stretched 2× horizontally. Resizing to square
before anything else is what "regularise the orientation" actually means here.

---

## What is measured

- **Leakage experiment**, identical architecture, epochs and seed, trained on a random slice
  split and on a patient-grouped split. The difference is caused by the split and nothing else.
- **Patient-level evaluation**, slice probabilities averaged within each person. A radiologist
  reads a volume, not one cut.
- **Ordinal metrics**, quadratic weighted kappa, because CDR 0 / 0.5 / 1 / 2 is an ordered scale
  and confusing Non with Moderate is worse than confusing Non with Very mild.
- **Shortcut probe**, retrained with the brain erased, leaving only skull and background. If the
  label is still predictable, the main results are contaminated by a non-anatomical confound.
- **Morphometry baseline**, logistic regression on the ventricle-to-brain area ratio and seven
  other hand-measured numbers. If the CNN cannot beat a ruler, it has not earned its complexity.
- **Calibration and abstention**, temperature scaling, then accuracy as a function of how many
  of the least-confident patients get deferred to a clinician.

---

## Setup

Requires [uv](https://docs.astral.sh/uv/) and Node 20+.

```bash
uv venv --python 3.12 && uv sync
```

The dataset is not in this repo (1.4 GB). Download the OASIS-1 Alzheimer's MRI collection and
place the four class folders, `Non Demented`, `Very mild Dementia`, `Mild Dementia`,
`Moderate Dementia`, so that `data/` points at their parent:

```bash
ln -s /path/to/Data data
```

## Running

```bash
# ~2 h: validates the entire pipeline on one patient-grouped holdout
./scripts/run_stage_a.sh

# overnight: full 5-fold patient-grouped cross-validation
./scripts/run_stage_b_overnight.sh
```

Individual steps:

```bash
.venv/bin/python -m src.neurolink.data.manifest              # parse filenames -> manifest.csv
.venv/bin/python -m src.neurolink.data.preprocess            # build the 224px uint8 memmap
.venv/bin/python -m src.neurolink.data.preprocess --probe 2  # visual sanity check first
.venv/bin/python -m src.neurolink.data.splits                # folds + leakage guard self-test
.venv/bin/python -m src.neurolink.experiments.leakage        # the headline experiment
.venv/bin/python -m src.neurolink.report                     # aggregate -> reports/results.json
```

## The website

Twelve content pages and four policy pages:

| Page | What is on it |
|---|---|
| Project | The leakage finding, the dataset, and what actually works |
| Try it | Drop in a scan, run the model in your browser, see where it looked |
| Explore | Cut through a real scan in three directions, and measure the fluid spaces |
| Check your data | Paste your own file names and find grouped leakage in your dataset |
| Results | Confusion matrix, curve, coverage slider, attention overlap, probes |
| Method | Preprocessing, splitting, the model, and the mistakes made along the way |
| References | Real papers, looked up rather than remembered |
| Privacy, Terms, Cookies, Accessibility | Written from what the site does, not from a template |

The **Check your data** page is the part worth reusing. It reads a list of file
names, works out what several files have in common (a patient, a video, a
speaker), and reports how many of those groups a random split would put on both
sides of the train and test line. It runs entirely in the browser and never
reads file contents.


```bash
cd web && npm install && npm run build   # static export to web/out
```

Vercel cannot run PyTorch, so the model is exported to ONNX and executed in the browser with
onnxruntime-web. The exported graph returns logits **and** all four class activation maps, computed
inside the graph as a 1×1 convolution with the classifier's weights, so the attention overlay
needs no gradients, which is what makes it possible in WASM at all. Every model in `models/` uses
a global-average-pool head for exactly this reason.

The site's demo runs the TypeScript reimplementation of the preprocessing pipeline
(`web/lib/preprocess.ts`) on the raw JPG and compares its output against the PyTorch probabilities
computed offline for that same file. If the two pipelines ever drift, the page says so on screen.

## Layout

```
src/neurolink/
  constants.py           class definitions, CDR mapping, expected dataset shape
  data/manifest.py       filename -> (subject, scan, slice, label)
  data/preprocess.py     grayscale, un-squash, head crop, normalise -> memmap
  data/splits.py         StratifiedGroupKFold by patient + the leakage guard
  data/dataset.py        memmap Dataset + batched per-sample GPU augmentation
  models/                scratch CNN and CAM-compatible pretrained backbones
  train.py               one model, one split
  evaluate.py            patient-level aggregation, temperature scaling, abstention
  metrics.py             the metrics, and why Dice/IoU are not among them
  explain.py             CAM, ventricle mask, genuine Dice/IoU with null controls
  experiments/           leakage experiment, shortcut probe
  baselines/             ventricle morphometry + logistic regression
  export_onnx.py         ONNX export with PyTorch parity check
web/                     Next.js static site
```

## Data

OASIS-1 (Open Access Series of Imaging Studies), cross-sectional. Labels are clinician-assigned
CDR scores, not autopsy-confirmed diagnoses. Please cite the OASIS authors if you use the data.
