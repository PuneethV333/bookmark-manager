interface ProgressStripProps {
  label: string;
}

/** Indeterminate progress: the API reports no partial progress while a batch runs. */
const ProgressStrip = ({ label }: ProgressStripProps) => (
  <div role="status" className="rounded-lg border border-ink-700 bg-ink-900 px-3 py-2">
    <p className="font-mono text-[11px] text-zinc-400">{label}</p>
    <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink-700">
      <div className="h-full w-2/5 rounded-full bg-emerald-400 animate-slide motion-reduce:animate-none" />
    </div>
  </div>
);

export default ProgressStrip;
