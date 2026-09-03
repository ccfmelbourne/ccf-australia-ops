"use client";

import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent, ReactNode } from "react";
import { Button } from "@/components/Button";

export interface FileDropzoneProps {
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  onFilesSelected: (files: File[]) => void;
  buttonLabel: ReactNode;
  helperText?: ReactNode;
}

// A drag-and-drop zone plus a hidden native file input triggered by a
// visible button. Deliberately stateless about the files once selected --
// no preview grid, no per-file progress -- since that's specific to what
// the caller does with them (ReceiptManager's own upload+scan pipeline),
// not something a generic dropzone should own.
export function FileDropzone({
  accept,
  multiple,
  disabled,
  onFilesSelected,
  buttonLabel,
  helperText,
}: FileDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFilesChosen(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (files.length === 0) return;
    onFilesSelected(files);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    onFilesSelected(files);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragging(false);
      }}
      onDrop={handleDrop}
      className={`flex flex-col items-center gap-2 rounded-md border-2 border-dashed p-6 text-center transition-colors ${
        isDragging ? "border-teal-500 bg-teal-50" : "border-slate-300"
      }`}
    >
      <span aria-hidden className="text-2xl text-slate-400">
        ↑
      </span>
      <p className="text-sm font-medium text-slate-700">Drag &amp; drop files</p>
      <p className="text-xs text-slate-500">or</p>
      {/* The real file input stays functional (keyboard/AT accessible)
          but visually hidden -- the button below triggers it. */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFilesChosen}
        tabIndex={-1}
        aria-hidden
        className="sr-only"
      />
      <Button disabled={disabled} onClick={() => fileInputRef.current?.click()}>
        {buttonLabel}
      </Button>
      {helperText && <p className="text-xs text-slate-500">{helperText}</p>}
    </div>
  );
}
