"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useField } from "@payloadcms/ui";

interface TagsFieldProps {
  path: string;
}

function parseTagsString(raw: string): string[] {
  return raw
    .split(";")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

function serializeTags(tags: string[]): string {
  return tags.join("; ");
}

export default function TagsField({ path }: TagsFieldProps) {
  const { value, setValue } = useField<string>({ path });

  const tags = parseTagsString(value ?? "");

  const [inputValue, setInputValue] = useState("");
  const [allKnownTags, setAllKnownTags] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch all known tags from existing tesselas once on mount
  useEffect(() => {
    fetch("/api/tesselas?limit=500&depth=0")
      .then((r) => r.json())
      .then((data) => {
        const known = new Set<string>();
        (data.docs ?? []).forEach((doc: { tags?: string }) => {
          if (doc.tags) parseTagsString(doc.tags).forEach((t) => known.add(t));
        });
        setAllKnownTags([...known].sort());
      })
      .catch(() => {});
  }, []);

  const suggestions = allKnownTags.filter((t) => {
    if (tags.includes(t)) return false;
    if (inputValue.trim()) return t.includes(inputValue.toLowerCase().trim());
    return true;
  });

  const addTag = useCallback(
    (tagStr: string) => {
      const trimmed = tagStr.trim().toLowerCase();
      if (!trimmed || tags.includes(trimmed)) return;
      setValue(serializeTags([...tags, trimmed]));
    },
    [tags, setValue],
  );

  const commitInput = useCallback(() => {
    inputValue
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach(addTag);
    setInputValue("");
  }, [inputValue, addTag]);

  const removeTag = useCallback(
    (index: number) => {
      setValue(serializeTags(tags.filter((_, i) => i !== index)));
    },
    [tags, setValue],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitInput();
    } else if (e.key === ";") {
      e.preventDefault();
      commitInput();
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
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
        Tags
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
        {tags.map((t, i) => (
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
              fontFamily: "var(--font-mono, monospace)",
              lineHeight: 1.6,
            }}
          >
            {t}
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                removeTag(i);
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
          placeholder={tags.length === 0 ? "Add tags — type and press Enter or ;" : ""}
          style={{
            flex: "1 1 100px",
            minWidth: "100px",
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
          {suggestions.slice(0, 40).map((tag) => (
            <button
              key={tag}
              type="button"
              tabIndex={0}
              onMouseDown={(e) => {
                e.preventDefault(); // keep focus in container
                addTag(tag);
              }}
              style={{
                background: "var(--theme-elevation-100, #222)",
                border: "1px solid var(--theme-border-color, #333)",
                borderRadius: "4px",
                padding: "2px 8px",
                fontSize: "11px",
                cursor: "pointer",
                color: "var(--theme-text-light, #999)",
                fontFamily: "var(--font-mono, monospace)",
              }}
            >
              + {tag}
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
        tag · Click suggestion to add instantly
      </p>
    </div>
  );
}
