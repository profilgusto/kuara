"use client";
import React from "react";
import { Download as DownloadIcon, FileText } from "lucide-react";

interface DownloadProps {
  url: string;
  filename?: string;
  label?: string;
  className?: string;
}

export default function Download({
  url,
  filename,
  label,
  className,
}: DownloadProps) {
  return (
    <div className={`my-8 ${className || ""}`}>
      <a
        href={url}
        download={filename || true}
        className="
                    flex items-center gap-4 p-4 rounded-xl border border-emerald-500/20 
                    bg-emerald-500/5 hover:bg-emerald-500/10 
                    transition-all duration-200 group no-underline
                "
      >
        <div className="p-3 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-all">
          <DownloadIcon size={20} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-emerald-500/70" />
            <span className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
              {label || "Download de Arquivo"}
            </span>
          </div>
          {filename && (
            <code className="text-[10px] text-emerald-800/50 dark:text-emerald-200/40 font-mono">
              {filename}
            </code>
          )}
        </div>
      </a>
    </div>
  );
}
