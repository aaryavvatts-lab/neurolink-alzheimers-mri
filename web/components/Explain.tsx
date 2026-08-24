"use client";
import type { Results } from "@/lib/types";
import { Bar, Note, Stat } from "./ui";

export default function Explain({ r }: { r: Results }) {
  const cam = r.cam_ventricle_overlap;
  const probe = r.shortcut_probe;

  return (
    <div className="space-y-8">
      <div className="card p-5">
        <p className="mb-2 text-sm font-medium text-white">
          Why Dice and IoU cannot validate this model
        </p>
        <p className="lead mb-3">
          Dice and IoU measure how much a <em>predicted region</em> overlaps a{" "}
          <em>true region</em>. They are segmentation metrics. A classifier that emits four
          probabilities produces no region at all, so there is nothing to intersect — computed on
          a classification output they quietly degenerate into F1 and the Jaccard index, and
          reporting them as segmentation scores would be a category error.
        </p>
        <p className="lead">
          But there is a genuinely spatial question worth asking with them:{" "}
          <strong className="text-white">does the model actually look at the ventricles?</strong>{" "}
          Ventricular enlargement, as surrounding tissue is lost, is the classic structural
          signature of Alzheimer&apos;s on MRI. So we threshold the model&apos;s activation map into a
          binary &ldquo;where it looked&rdquo; region, derive a ventricle mask from the anatomy, and
          measure the overlap. Same metrics, valid application.
        </p>
      </div>

      {cam ? (
        <div className="card p-5">
          <p className="mb-1 text-sm font-medium text-white">
            Attention-vs-ventricle overlap, with null controls
          </p>
          <p className="mb-4 text-xs text-muted">
            Measured over {cam.n_slices} held-out mid-brain slices, taking the top{" "}
            {(cam.cam_top_frac * 100).toFixed(0)}% of activation as the attended region.
          </p>
          <div className="space-y-3">
            <Bar label="Trained model" value={cam.trained_model.dice} max={0.8} tone="good"
              right={`Dice ${cam.trained_model.dice.toFixed(3)} · IoU ${cam.trained_model.iou.toFixed(3)}`} />
            <Bar label="Control: untrained network, same architecture" value={cam.control_untrained_cnn.dice} max={0.8}
              right={`Dice ${cam.control_untrained_cnn.dice.toFixed(3)} · IoU ${cam.control_untrained_cnn.iou.toFixed(3)}`} />
            <Bar label="Control: a centred blob of equal area" value={cam.control_centred_blob.dice} max={0.8}
              right={`Dice ${cam.control_centred_blob.dice.toFixed(3)} · IoU ${cam.control_centred_blob.iou.toFixed(3)}`} />
          </div>
          <Note tone={cam.trained_model.dice > Math.max(cam.control_untrained_cnn.dice, cam.control_centred_blob.dice) ? "good" : "warn"}>
            <strong>Verdict:</strong> {cam.verdict}
          </Note>
          <p className="mt-3 text-[11px] text-muted">
            The controls are the point. In a centred brain image almost any blob near the middle
            overlaps the ventricles somewhat, so a Dice of 0.4 on its own means nothing. Only the
            comparison against &ldquo;random network&rdquo; and &ldquo;dumb centred circle&rdquo;
            turns the number into evidence.
          </p>
        </div>
      ) : (
        <Note>The attention-overlap analysis has not been run yet.</Note>
      )}

      {probe && (
        <div className="card p-5">
          <p className="mb-1 text-sm font-medium text-white">Shortcut probe — is it reading the brain at all?</p>
          <p className="mb-4 text-xs text-muted">
            The same model retrained on images with the brain erased. Skull, scalp and background
            remain; there is no dementia information left. Anything above chance means something
            outside the brain correlates with the label.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat value={probe.subject_level_balanced_accuracy.toFixed(3)}
              tone={probe.subject_level_balanced_accuracy < probe.chance_level + 0.15 ? "good" : "warn"}
              label="Balanced accuracy with the brain removed" />
            <Stat value={probe.chance_level.toFixed(2)} label="Chance level (4 classes)" />
            <Stat value={(probe.subject_level_balanced_accuracy - probe.chance_level).toFixed(3)}
              tone={probe.subject_level_balanced_accuracy < probe.chance_level + 0.15 ? "good" : "warn"}
              label="Margin above chance" sub="near zero is the good outcome" />
          </div>
          <Note tone={probe.subject_level_balanced_accuracy < probe.chance_level + 0.15 ? "good" : "warn"}>
            {probe.verdict}
          </Note>
        </div>
      )}
    </div>
  );
}
