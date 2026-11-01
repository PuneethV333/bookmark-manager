import { useEffect, useRef, useState } from "react";
import { FiMoreVertical, FiTrash2 } from "react-icons/fi";
import { cn } from "../utils/cn";

interface BookmarkMenuProps {
  /** Series title, used for the trigger and menu labels. */
  label: string;
  onDelete: () => Promise<void>;
}

const BookmarkMenu = ({ label, onDelete }: BookmarkMenuProps) => {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setConfirming(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setConfirming(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  /** Deleting is permanent, so the menu item asks for a second click. */
  const handleDelete = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    setDeleting(true);

    try {
      await onDelete();
      setOpen(false);
      setConfirming(false);
    } catch {
      // The library already shows the error toast; stay open so it can retry.
      setConfirming(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Actions for ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
          setConfirming(false);
        }}
        className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-ink-950/75 text-zinc-300 shadow-sm backdrop-blur transition-colors hover:bg-ink-950 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
      >
        <FiMoreVertical aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={`${label} actions`}
          className="absolute top-full right-0 z-20 mt-1 w-44 rounded-lg border border-ink-600 bg-ink-800 p-1 shadow-xl shadow-black/40"
        >
          <button
            type="button"
            role="menuitem"
            autoFocus
            disabled={deleting}
            onClick={handleDelete}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors disabled:opacity-60",
              confirming || deleting
                ? "bg-rose-500/10 text-rose-300 hover:bg-rose-500/15"
                : "text-zinc-300 hover:bg-ink-700 hover:text-white",
            )}
          >
            <FiTrash2 aria-hidden />
            {deleting ? "Deleting…" : confirming ? "Delete permanently" : "Delete"}
          </button>
        </div>
      )}
    </div>
  );
};

export default BookmarkMenu;
