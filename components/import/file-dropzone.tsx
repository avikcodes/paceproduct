"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

type FileDropzoneProps = {
  onFile: (file: File) => void;
  disabled?: boolean;
  hint?: string;
};

export function FileDropzone({
  onFile,
  disabled = false,
  hint = "Upload a .csv file up to 5 MB with up to 5000 rows",
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  return (
    <label
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center outline-none transition-colors select-none",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-border hover:bg-muted/40",
        "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        disabled && "pointer-events-none opacity-60",
      )}
      onDragOver={(event) => {
        if (disabled) return;
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragEnter={(event) => {
        if (disabled) return;
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        if (disabled) return;
        event.preventDefault();
        setIsDragging(false);
      }}
      onDrop={(event) => {
        if (disabled) return;
        event.preventDefault();
        setIsDragging(false);
        const file = event.dataTransfer.files?.[0];
        if (file) {
          onFile(file);
        }
      }}
    >
      <div className="grid size-10 place-items-center rounded-lg bg-muted/50">
        <Upload className="size-5 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">
          Choose a CSV file
        </span>
        <span className="text-xs text-muted-foreground">
          or drag and drop your file here
        </span>
      </div>
      <span className="text-xs text-muted-foreground">{hint}</span>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onFile(file);
          }
          event.target.value = "";
        }}
      />
    </label>
  );
}
