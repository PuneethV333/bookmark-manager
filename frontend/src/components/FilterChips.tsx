import { cn } from "../utils/cn";

interface Chip<T extends string> {
  value: T;
  label: string;
  count: number;
}

interface FilterChipsProps<T extends string> {
  label: string;
  value: T;
  chips: Chip<T>[];
  onChange: (value: T) => void;
}

function FilterChips<T extends string>({ label, value, chips, onChange }: FilterChipsProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => {
        const active = chip.value === value;
        return (
          <button
            key={chip.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(chip.value)}
            className={cn(
              "inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-emerald-400",
              active
                ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300"
                : "border-ink-600 text-zinc-400 hover:text-zinc-100",
            )}
          >
            {chip.label}
            <span className="font-mono text-[10px] text-zinc-500">{chip.count}</span>
          </button>
        );
      })}
    </div>
  );
}

export default FilterChips;
