import type { ReactNode } from "react";

interface StepCardProps {
  step: number;
  icon: ReactNode;
  title: string;
  hint: string;
  children: ReactNode;
}

const StepCard = ({ step, icon, title, hint, children }: StepCardProps) => (
  <li className="relative flex flex-col gap-3 rounded-xl border border-ink-700 bg-ink-900 p-5">
    <span aria-hidden className="absolute top-3 right-4 font-mono text-4xl font-medium text-ink-700">
      {step}
    </span>
    <span className="grid h-9 w-9 place-items-center rounded-lg border border-ink-600 bg-ink-800 text-emerald-400">
      {icon}
    </span>
    <h3 className="text-sm font-semibold text-white">{title}</h3>
    <p className="text-sm leading-relaxed text-zinc-400">{children}</p>
    <p className="mt-auto pt-2 font-mono text-[11px] text-emerald-400">{hint}</p>
  </li>
);

export default StepCard;
