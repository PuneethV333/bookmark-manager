import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

const EmptyState = ({ icon, title, description, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center rounded-2xl border border-dashed border-ink-600 bg-ink-900 px-6 py-16 text-center">
    <span className="grid h-12 w-12 place-items-center rounded-xl border border-ink-600 bg-ink-800 text-xl text-zinc-400">
      {icon}
    </span>
    <h2 className="mt-4 text-base font-semibold text-white">{title}</h2>
    <p className="mt-1 max-w-sm text-sm text-zinc-400">{description}</p>
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export default EmptyState;
