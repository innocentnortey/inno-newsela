"use client";

import { forwardRef, useId, useRef, useState, type DragEvent } from "react";
import { cn } from "@/lib/cn";

export interface DropZoneProps {
  file: File | null;
  onFile(file: File): void;
  onReject(): void;
  error?: string;
  disabled?: boolean;
}

export const DropZone = forwardRef<HTMLButtonElement, DropZoneProps>(function DropZone(
  { file, onFile, onReject, error, disabled },
  ref,
) {
  const hintId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function accept(f: File | undefined) {
    if (!f) return;
    const n = f.name.toLowerCase();
    if (n.endsWith(".csv") || n.endsWith(".xlsx")) onFile(f);
    else onReject();
  }
  function onDrop(ev: DragEvent<HTMLButtonElement>) {
    ev.preventDefault();
    setDragging(false);
    accept(ev.dataTransfer.files[0]);
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        aria-describedby={error ? `${hintId} ${errorId}` : hintId}
        data-dragging={dragging || undefined}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "bg-well text-ink text-body rounded-lg border border-dashed px-4 py-8 font-semibold",
          "min-h-9 w-full",
          error ? "border-danger" : "border-edge",
          dragging && "bg-selected",
          "disabled:opacity-50",
        )}
      >
        Choose file
      </button>
      <p id={hintId} className="text-small text-ink2">
        CSV or XLSX, up to 200 rows
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx"
        hidden
        tabIndex={-1}
        onChange={(e) => {
          const f = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          accept(f);
        }}
      />
      {file ? (
        <p data-testid="chosen-file" className="text-body text-ink">
          Chosen: {file.name}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-small text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
});
