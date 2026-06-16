import React, { useState, useRef, useEffect } from "react";
import { UploadCloud, X, File } from "lucide-react";

export interface FileData {
  name: string;
  url: string; // base64
  type: string;
}

interface FileUploadDropzoneProps {
  files: FileData[];
  onChange: (files: FileData[]) => void;
  maxFiles?: number;
}

export function FileUploadDropzone({
  files,
  onChange,
  maxFiles = 5,
}: FileUploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (
          item.type.indexOf("image") !== -1 ||
          item.type.indexOf("application/pdf") !== -1 ||
          item.type.indexOf("text/") !== -1
        ) {
          const file = item.getAsFile();
          if (file) handleFiles([file]);
        }
      }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [files]);

  const handleFiles = (newFiles: File[]) => {
    const processedFiles: FileData[] = [];
    const supportedTypes = [
      "application/pdf",
      "text/",
      "image/",
      "application/x-javascript",
      "text/javascript",
      "application/x-python",
      "text/x-python",
      "text/html",
      "text/css",
      "text/md",
      "text/csv",
      "text/xml",
      "text/rtf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ];

    Array.from(newFiles).forEach((file) => {
      const isSupported =
        supportedTypes.some((type) => file.type.startsWith(type)) ||
        file.name.endsWith(".txt") ||
        file.name.endsWith(".csv") ||
        file.name.endsWith(".md") ||
        file.name.endsWith(".docx") ||
        file.name.endsWith(".doc");

      if (!isSupported) {
        alert(
          `File type not supported: ${file.name}. Please use PDF, Images, Text, or DOCX formats.`,
        );
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        processedFiles.push({
          name: file.name,
          url: reader.result as string,
          type: file.type || "text/plain",
        });

        if (
          processedFiles.length > 0 &&
          processedFiles.length ===
            Array.from(newFiles).filter(
              (f) =>
                supportedTypes.some((t) => f.type.startsWith(t)) ||
                f.name.endsWith(".txt") ||
                f.name.endsWith(".csv") ||
                f.name.endsWith(".md") ||
                f.name.endsWith(".docx") ||
                f.name.endsWith(".doc"),
            ).length
        ) {
          onChange([...files, ...processedFiles].slice(0, maxFiles));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const removeFile = (indexToRemove: number) => {
    onChange(files.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`w-full flex-col p-6 flex justify-center items-center border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
          isDragging
            ? "border-sky-500 bg-sky-50/50 dark:bg-sky-900/20"
            : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*,application/pdf,text/*,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          multiple
        />
        <UploadCloud className="w-8 h-8 text-neutral-400" />
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700"
            >
              <div className="flex items-center space-x-3 overflow-hidden text-ellipsis whitespace-nowrap">
                {file.type.startsWith("image/") ? (
                  <img
                    src={file.url}
                    alt={file.name}
                    className="w-8 h-8 object-cover rounded"
                  />
                ) : (
                  <File className="w-8 h-8 text-neutral-500" />
                )}
                <span className="text-sm text-neutral-700 dark:text-neutral-300 truncate">
                  {file.name}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(i);
                }}
                className="p-1 rounded bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                title="Remove"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
