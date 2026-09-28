import { FiChevronDown } from "react-icons/fi";

interface Option<T extends string> {
  value: T;
  label: string;
}

interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}

function SelectField<T extends string>({ label, value, options, onChange }: SelectFieldProps<T>) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="h-10 w-full appearance-none rounded-lg border border-ink-600 bg-ink-800 pr-9 pl-3 text-sm text-zinc-100 focus-visible:outline-2 focus-visible:outline-emerald-400"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FiChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-zinc-500" />
    </label>
  );
}

export default SelectField;
