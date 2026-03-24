"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const TodosNavLink: React.FC = () => {
  const pathname = usePathname();
  const isActive = pathname?.startsWith("/admin/todos") ?? false;

  return (
    <div style={{ padding: "0 8px", marginBottom: "4px" }}>
      <Link
        href="/admin/todos"
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
        {/* ListTodo icon */}
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
          <rect x="3" y="5" width="6" height="6" rx="1" />
          <path d="m3 17 2 2 4-4" />
          <path d="M13 6h8" />
          <path d="M13 12h8" />
          <path d="M13 18h8" />
        </svg>
        TODOs
      </Link>
    </div>
  );
};

export default TodosNavLink;
