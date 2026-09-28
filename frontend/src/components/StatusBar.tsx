import type { BatchCheckResult } from "../type/bookmark.type";
import { pluralize, timeAgo } from "../utils/format";

interface StatusBarProps {
  total: number;
  lastCheckedAt: string | null;
  lastRun: BatchCheckResult | null;
}

const StatusBar = ({ total, lastCheckedAt, lastRun }: StatusBarProps) => (
  <footer className="mt-auto border-t border-ink-700 bg-ink-900/60">
    <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 font-mono text-[11px] text-zinc-500 sm:px-6">
      <span>
        {total} {pluralize(total, "series", "series")}
      </span>
      <span>
        Last checked <span className="text-zinc-300">{timeAgo(lastCheckedAt)}</span>
      </span>
      {lastRun && (
        <span>
          This visit: <span className="text-zinc-300">{lastRun.checked}</span> checked,{" "}
          <span className="text-zinc-300">{lastRun.skipped}</span> skipped,{" "}
          <span className={lastRun.failed > 0 ? "text-rose-400" : "text-zinc-300"}>{lastRun.failed}</span> failed
        </span>
      )}
    </div>
  </footer>
);

export default StatusBar;
