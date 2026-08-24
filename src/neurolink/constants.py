"""Label definitions for OASIS-1 CDR staging.

The four classes are ORDINAL -- they are Clinical Dementia Rating scores, not
arbitrary categories. Confusing Non-demented with Moderate is a worse error than
confusing it with Very mild, which is why we report quadratic weighted kappa
alongside accuracy.
"""

# Directory name -> (class index, CDR score)
CLASS_DIRS = {
    "Non Demented":       (0, 0.0),
    "Very mild Dementia": (1, 0.5),
    "Mild Dementia":      (2, 1.0),
    "Moderate Dementia":  (3, 2.0),
}

CLASS_NAMES = ["Non Demented", "Very mild Dementia", "Mild Dementia", "Moderate Dementia"]
SHORT_NAMES = ["Non", "Very mild", "Mild", "Moderate"]
CDR_VALUES = [0.0, 0.5, 1.0, 2.0]
N_CLASSES = 4

# Post-hoc collapses of the same 4-class predictions. Moderate has only TWO
# subjects, so 4-class per-class metrics for it are anecdotal; these collapses
# give us tasks with defensible statistics.
COLLAPSE_3CLASS = {0: 0, 1: 1, 2: 2, 3: 2}   # Non / Very mild / Mild+Moderate
NAMES_3CLASS = ["Non", "Very mild", "Mild+Moderate"]
COLLAPSE_BINARY = {0: 0, 1: 1, 2: 1, 3: 1}   # Non-demented vs any dementia
NAMES_BINARY = ["Non-demented", "Any dementia"]

# Expected dataset shape -- asserted at manifest build time so silent data
# corruption or a partial download cannot quietly change the results.
EXPECTED_IMAGES = 86437
EXPECTED_SUBJECTS = 347
RAW_SIZE = (496, 248)  # (W, H) -- the 248x248 slice stretched 2x horizontally
