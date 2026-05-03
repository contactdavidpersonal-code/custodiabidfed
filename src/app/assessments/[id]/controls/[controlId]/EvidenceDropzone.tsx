"use client";

import { useCallback, useRef, useState } from "react";

type Props = {
  action: (formData: FormData) => Promise<void> | void;
  assessmentId: string;
  controlId: string;
  questionId?: string;
  compact?: boolean;
};

const ACCEPT =
  "image/*,application/pdf,text/csv,text/plain,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const MAX_BYTES = 25 * 1024 * 1024;

export function EvidenceDropzone({
  action,
  assessmentId,
  controlId,
  questionId,
  compact,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const setFromList = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (f.size > MAX_BYTES) {
      setError("File is over 25 MB. Try splitting it or compressing.");
      setFile(null);
      return;
    }
    setError(null);
    setFile(f);
    if (inputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(f);
      inputRef.current.files = dt.files;
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      setFromList(e.dataTransfer.files);
    },
    [setFromList],
  );

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  return (
    <form
      ref={formRef}
      action={action}
      encType="multipart/form-data"
      onSubmit={() => setUploading(true)}
    >
      <input type="hidden" name="assessmentId" value={assessmentId} />
      <input type="hidden" name="controlId" value={controlId} />
      {questionId && (
        <input type="hidden" name="questionId" value={questionId} />
      )}

      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragEnter={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={`relative cursor-pointer  border border-dashed transition-colors ${
          compact ? "px-4 py-5" : "px-6 py-8"
        } ${
          dragActive
            ? "border-[#2f8f6d] bg-[#eaf3ee]"
            : file
              ? "border-[#2f8f6d] bg-[#f7fcf9]"
              : "border-[#cfe3d9] bg-[#f7fcf9] hover:border-[#2f8f6d] hover:bg-[#eef6f1]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          name="file"
          required
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => setFromList(e.target.files)}
        />
        <div className="flex flex-col items-center text-center">
          <span className="flex h-10 w-10 items-center justify-center  bg-[#0e2a23] text-[#bdf2cf]">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden>
              <path d="M10 3a1 1 0 01.7.29l4 4a1 1 0 11-1.4 1.42L11 6.41V13a1 1 0 11-2 0V6.41L6.7 8.71A1 1 0 015.29 7.3l4-4A1 1 0 0110 3zM4 14a1 1 0 011 1v1h10v-1a1 1 0 112 0v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2a1 1 0 011-1z" />
            </svg>
          </span>
          {file ? (
            <div className="mt-3">
              <div className="font-serif text-sm font-bold text-[#10231d]">
                {file.name}
              </div>
              <div className="mt-0.5 text-[11px] text-[#5a7d70]">
                {(file.size / 1024 / 1024).toFixed(2)} MB &middot; Click to change
              </div>
            </div>
          ) : (
            <div className="mt-3">
              <div className="font-serif text-sm font-bold text-[#10231d]">
                {dragActive ? "Drop to attach" : "Drag a file here, or click to browse"}
              </div>
              <div className="mt-0.5 text-[11px] text-[#5a7d70]">
                PNG / JPG / PDF auto-review. CSV / Excel / Word need officer clearance.
                25&nbsp;MB max.
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-2 text-xs font-semibold text-[#b03a2e]">{error}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {file && (
          <button
            type="button"
            onClick={() => {
              setFile(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className=" border border-[#cfe3d9] bg-white px-3 py-2 text-xs font-bold text-[#0e2a23] transition-colors hover:border-[#2f8f6d] hover:bg-[#f1f6f3]"
          >
            Clear
          </button>
        )}
        <button
          type="submit"
          disabled={!file || uploading}
          className=" bg-[#0e2a23] px-5 py-2.5 text-sm font-bold tracking-tight text-[#bdf2cf] transition-colors hover:bg-[#10342a] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {uploading ? "Uploading\u2026" : "Upload to vault"}
        </button>
      </div>
    </form>
  );
}
