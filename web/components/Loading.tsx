export function Loading({ what = "numbers" }: { what?: string }) {
  return <p className="p-small py-8">Loading the {what}.</p>;
}

export function LoadError() {
  return (
    <div className="border-l-2 border-brick bg-white/60 px-4 py-3">
      <p className="text-[0.9375rem] text-body">
        The results file has not been built yet. Run the training scripts, then{" "}
        <code className="font-mono text-[0.875rem]">python -m src.neurolink.report</code>.
      </p>
    </div>
  );
}
