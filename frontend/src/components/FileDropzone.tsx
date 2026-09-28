import { useRef, useState, type DragEvent } from "react";
import { FiFolder, FiUploadCloud } from "react-icons/fi";
import { cn } from "../utils/cn";
import Button from "./Button";
import Spinner from "./Spinner";

interface FileDropzoneProps {
  accept: string;
  title: string;
  description: string;
  busy?: boolean;
  busyTitle?: string;
  busyDescription?: string;
  onFile: (file: File) => void;
}

const FileDropzone = ({
  accept,
  title,
  description,
  busy = false,
  busyTitle = "Working…",
  busyDescription,
  onFile,
}: FileDropzoneProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (busy) return;
    const file = event.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!busy) setDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      aria-busy={busy}
      className={cn(
        "flex flex-col items-center rounded-2xl border border-dashed px-6 py-12 text-center transition-colors",
        dragging ? "border-emerald-400 bg-emerald-400/5" : "border-ink-600 bg-ink-900",
      )}
    >
      <div className="grid h-16 w-16 place-items-center rounded-2xl border border-ink-600 bg-ink-800 text-3xl text-emerald-400">
        {busy ? <Spinner /> : <FiUploadCloud aria-hidden />}
      </div>

      <h2 className="mt-5 text-lg font-semibold text-white">{busy ? busyTitle : title}</h2>
      <p className="mt-1 max-w-md text-sm text-zinc-400" role={busy ? "status" : undefined}>
        {busy ? busyDescription : description}
      </p>

      {!busy && (
        <>
          <Button
            variant="secondary"
            icon={<FiFolder aria-hidden />}
            className="mt-6"
            onClick={() => inputRef.current?.click()}
          >
            Browse files
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = ""; // lets the same file be picked again
              if (file) onFile(file);
            }}
          />
        </>
      )}
    </div>
  );
};

export default FileDropzone;
