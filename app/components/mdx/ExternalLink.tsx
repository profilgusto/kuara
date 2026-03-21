"use client";
import React from "react";
import { ExternalLink as ExternalLinkIcon } from "lucide-react";

interface ExternalLinkProps {
  url: string;
  title?: string;
  description?: string;
  className?: string;
}

export default function ExternalLink({
  url,
  title,
  description,
  className,
}: ExternalLinkProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`
                group block my-6 p-4 rounded-xl border border-blue-500/20 
                bg-blue-500/5 hover:bg-blue-500/10 
                transition-all duration-200 no-underline
                ${className || ""}
            `}
    >
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-lg bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform">
          <ExternalLinkIcon size={24} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="m-0 text-lg font-semibold text-blue-900 dark:text-blue-100 truncate">
            {title || "Link Externo"}
          </h4>
          {description && (
            <p className="m-0 mt-1 text-sm text-blue-800/70 dark:text-blue-200/60 line-clamp-1">
              {description}
            </p>
          )}
        </div>
      </div>
    </a>
  );
}
