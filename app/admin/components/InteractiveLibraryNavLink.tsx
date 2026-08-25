"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Sidebar entry for the interactive-widget library. Mirrors TodosNavLink —
 * the admin has no Tailwind, so the styling is inline against Payload's
 * theme variables.
 */
export const InteractiveLibraryNavLink: React.FC = () => {
  const pathname = usePathname();
  const isActive = pathname?.startsWith("/payload/interativos") ?? false;

  return (
    <div style={{ padding: "0 8px", marginBottom: "4px" }}>
      <Link
        href="/payload/interativos"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 12px",
          borderRadius: "4px",
          color: isActive
            ? "var(--theme-elevation-1000, #fff)"
            : "var(--theme-elevation-700, #bbb)",
          background: isActive
            ? "var(--theme-elevation-150, #252525)"
            : "transparent",
          textDecoration: "none",
          fontSize: "13px",
          fontWeight: 500,
        }}
      >
        {/* Boxes icon — same glyph the block's header uses on the site */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, opacity: 0.8 }}
        >
          <path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z" />
          <path d="m7 16.5-4.74-2.85" />
          <path d="m7 16.5 5-3" />
          <path d="M7 16.5v5.17" />
          <path d="M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z" />
          <path d="m17 16.5-5-3" />
          <path d="m17 16.5 4.74-2.85" />
          <path d="M17 16.5v5.17" />
          <path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z" />
          <path d="M12 8 7.26 5.15" />
          <path d="m12 8 4.74-2.85" />
          <path d="M12 13.5V8" />
        </svg>
        Interativos
      </Link>
    </div>
  );
};

export default InteractiveLibraryNavLink;
