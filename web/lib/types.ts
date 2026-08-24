export interface ClassInfo {
  name: string; short: string; cdr: number;
  images: number; subjects: number; images_pct: number;
}
export interface PerClass { precision: number; recall: number; f1: number; support: number; }
export interface BinaryBlock {
  accuracy: number; balanced_accuracy: number; sensitivity: number;
  specificity: number; roc_auc: number; pr_auc: number; confusion_matrix: number[][];
}
export interface Metrics {
  n: number; accuracy: number; balanced_accuracy: number; macro_f1: number;
  quadratic_kappa: number; confusion_matrix: number[][]; per_class: PerClass[];
  collapsed_3class: { balanced_accuracy: number; macro_f1: number; confusion_matrix: number[][] };
  binary_screening: BinaryBlock;
}
export interface RunBlock {
  model: string; split_mode: string; fold: number | null; mask_mode: string | null;
  leaking_split: boolean; minutes: number; best_epoch: number;
  n_train_subjects: number; n_test_subjects: number;
  slice_level: Metrics; subject_level: Metrics;
  calibration: { temperature: number; ece_slice_uncalibrated: number; ece_slice_calibrated: number; ece_subject_calibrated: number };
  abstention_subject: { coverage: number; accuracy: number; balanced_accuracy: number; min_confidence: number }[];
  subject_predictions: { subject: string; true: number; pred: number; probs: number[] }[];
}
export interface Results {
  stage: string;
  dataset: {
    total_images: number; total_subjects: number; slices_per_subject_median: number;
    slice_index_range: number[]; raw_resolution: string; classes: ClassInfo[];
  };
  runs: Record<string, RunBlock>;
  primary_run?: string;
  leakage_experiment?: {
    model: string; epochs: number;
    leaky_random_split: { accuracy: number; balanced_accuracy: number; macro_f1: number; subjects_in_both_train_and_test: number };
    honest_subject_split_slice_level: { accuracy: number; balanced_accuracy: number; macro_f1: number };
    honest_subject_split_subject_level: { accuracy: number; balanced_accuracy: number; macro_f1: number };
    inflation: { accuracy_points: number; balanced_accuracy_points: number };
  };
  shortcut_probe?: {
    subject_level_balanced_accuracy: number; slice_level_balanced_accuracy: number;
    chance_level: number; verdict: string;
  };
  cam_ventricle_overlap?: {
    n_slices: number; cam_top_frac: number;
    trained_model: { dice: number; iou: number };
    control_untrained_cnn: { dice: number; iou: number };
    control_centred_blob: { dice: number; iou: number };
    by_true_class: Record<string, { n: number; dice: number }>;
    verdict: string;
  };
  ventricle_baseline?: { slice_level: Metrics; subject_level: Metrics; n_test_subjects: number };
  crossval?: {
    model: string; n_folds: number; n_subjects_pooled: number; n_slices_pooled: number;
    per_fold: { fold: number; subject_balanced_accuracy: number; subject_quadratic_kappa: number; binary_roc_auc: number; n_test_subjects: number }[];
    fold_spread: { subject_balanced_accuracy_mean: number; subject_balanced_accuracy_std: number; subject_balanced_accuracy_min: number; subject_balanced_accuracy_max: number };
    pooled_slice_level: Metrics; pooled_subject_level: Metrics;
  };
}
export const SHORT = ["Non", "Very mild", "Mild", "Moderate"];
export const FULL = ["Non Demented", "Very mild Dementia", "Mild Dementia", "Moderate Dementia"];
