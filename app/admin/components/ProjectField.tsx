"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useField } from "@payloadcms/ui";
import { comBasePath } from "@/lib/base-path";

interface ProjectFieldProps {
  path: string;
}

function parseProjectsString(raw: string): string[] {
  return raw
    .split(";")
    .map((t) => t.trim())
    .filter(Boolean);
}

function serializeProjects(projects: string[]): string {
  return projects.join("; ");
}

export default function ProjectField({ path }: ProjectFieldProps) {
  const { value, setValue } = useField<string>({ path });

  const projects = parseProjectsString(value ?? "");

  const [inputValue, setInputValue] = useState("");
  const [allKnownProjects, setAllKnownProjects] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch all known project values from existing tesselas once on mount
  useEffect(() => {
    fetch(comBasePath("/api/tesselas?limit=500&depth=0"))
      .then((r) => r.json())
      .then((data) => {
        const known = new Set<string>();
        (data.docs ?? []).forEach((doc: { project?: string }) => {
          if (doc.project?.trim()) {
            parseProjectsString(doc.project).forEach((p) => known.add(p));
          }
        });
        setAllKnownProjects([...known].sort());
      })
      .catch(() => {});
  }, []);

  const suggestions = allKnownProjects.filter((p) => {
    if (projects.includes(p)) return false;
    if (inputValue.trim())
      return p.toLowerCase().includes(inputValue.toLowerCase().trim());
    return true;
  });

  const addProject = useCallback(
    (projectStr: string) => {
      const trimmed = projectStr.trim();
      if (!trimmed || projects.includes(trimmed)) return;
      setValue(serializeProjects([...projects, trimmed]));
    },
    [projects, setValue],
  );

  const commitInput = useCallback(() => {
    inputValue
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach(addProject);
    setInputValue("");
  }, [inputValue, addProject]);

  const removeProject = useCallback(
    (index: number) => {
      setValue(serializeProjects(projects.filter((_, i) => i !== index)));
    },
    [projects, setValue],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitInput();
    } else if (e.key === ";") {
      e.preventDefault();
      commitInput();
    } else if (e.key === "Backspace" && !inputValue && projects.length > 0) {
      removeProject(projects.length - 1);
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    if (containerRef.current?.contains(e.relatedTarget as Node)) return;
    setFocused(false);
    if (inputValue.trim()) commitInput();
  };

  return (
    <div
      ref={containerRef}
      style={{ display: "flex", flexDirection: "column", gap: "6px" }}
      onBlur={handleBlur}
    >
      {/* Label */}
      <label
        style={{
          fontSize: "13px",
          fontWeight: 600,
          color: "var(--theme-text, #e0e0e0)",
          marginBottom: "2px",
        }}
      >
        Project
      </label>

      {/* Chip row + inline input */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "5px",
          alignItems: "center",
          padding: "6px 10px",
          minHeight: "40px",
          background: "var(--theme-input-bg, #1a1a1a)",
          border: focused
            ? "1px solid var(--theme-text, #ccc)"
            : "1px solid var(--theme-border-color, #333)",
          borderRadius: "4px",
          cursor: "text",
          transition: "border-color 0.15s",
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {projects.map((p, i) => (
          <span
            key={i}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              background: "var(--theme-elevation-200, #2a2a2a)",
              color: "var(--theme-text, #e0e0e0)",
              borderRadius: "4px",
              padding: "2px 8px 2px 10px",
              fontSize: "12px",
              lineHeight: 1.6,
            }}
          >
            {p}
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                removeProject(i);
              }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--theme-text-light, #888)",
                padding: "0 0 0 2px",
                lineHeight: 1,
                fontSize: "16px",
                display: "flex",
                alignItems: "center",
              }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          placeholder={
            projects.length === 0 ? 'Add projects — e.g. "SLAM Robot"' : ""
          }
          style={{
            flex: "1 1 120px",
            minWidth: "120px",
            background: "none",
            border: "none",
            outline: "none",
            color: "var(--theme-text, #e0e0e0)",
            fontSize: "13px",
            padding: "2px 4px",
            fontFamily: "inherit",
          }}
        />
      </div>

      {/* Suggestion pills — shown when focused */}
      {focused && suggestions.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "4px",
            padding: "2px 0",
          }}
        >
          {suggestions.slice(0, 40).map((p) => (
            <button
              key={p}
              type="button"
              tabIndex={0}
              onMouseDown={(e) => {
                e.preventDefault();
                addProject(p);
              }}
              style={{
                background: "var(--theme-elevation-100, #222)",
                border: "1px solid var(--theme-border-color, #333)",
                borderRadius: "4px",
                padding: "2px 8px",
                fontSize: "11px",
                cursor: "pointer",
                color: "var(--theme-text-light, #999)",
              }}
            >
              + {p}
            </button>
          ))}
        </div>
      )}

      {/* Helper */}
      <p
        style={{
          fontSize: "11px",
          color: "var(--theme-text-light, #666)",
          margin: 0,
        }}
      >
        Type and press <kbd>Enter</kbd> or <kbd>;</kbd> · Backspace removes last
        · Click suggestion to add instantly
      </p>
    </div>
  );
}
