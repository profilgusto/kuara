"use client";

import React, { useState } from "react";

export const CopyKeyCell: React.FC<{ cellData?: string }> = ({ cellData }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!cellData) return;
    navigator.clipboard.writeText(cellData).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
      onClick={(e) => e.stopPropagation()}
    >
      <span>{cellData}</span>
      <button
        type="button"
        onClick={handleCopy}
        title="Copy key"
        style={{
          padding: "2px 8px",
          fontSize: "0.7rem",
          fontFamily: "inherit",
          cursor: "pointer",
          border: "1px solid var(--theme-elevation-150)",
          borderRadius: "4px",
          background: copied
            ? "var(--theme-success-500)"
            : "var(--theme-elevation-100)",
          color: copied
            ? "var(--theme-base-800)"
            : "var(--theme-elevation-800)",
          transition: "background 0.2s, color 0.2s",
          whiteSpace: "nowrap",
          lineHeight: 1.4,
        }}
      >
        {copied ? "✓ Copied" : "Copy Key"}
      </button>
    </div>
  );
};

export default CopyKeyCell;
