import { useEffect, useRef } from "react";
import { FiSearch } from "react-icons/fi";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** Press "/" anywhere on the page to focus. */
const SearchInput = ({ value, onChange, placeholder = "Search series" }: SearchInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const typing = target?.matches("input, textarea, select, [contenteditable='true']");
      if (typing) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <label className="relative block w-full">
      <span className="sr-only">Search series</span>
      <FiSearch aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-zinc-500" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-ink-600 bg-ink-800 pr-9 pl-9 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-2 focus-visible:outline-emerald-400 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {!value && (
        <kbd className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded border border-ink-600 px-1.5 font-mono text-[10px] text-zinc-500">
          /
        </kbd>
      )}
    </label>
  );
};

export default SearchInput;
