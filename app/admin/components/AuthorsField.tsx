"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useField } from "@payloadcms/ui";

interface AuthorsFieldProps {
  path: string;
}

/** 
 * Splits a ";" separated string into individual trimmed names.
 */
function parseAuthorsString(raw: string): string[] {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(";")
    .map((a) => a.trim())
    .filter(Boolean);
}

export default function AuthorsField({ path }: AuthorsFieldProps) {
  const { value, setValue } = useField<string>({ path });
  const [topAuthors, setTopAuthors] = useState<string[]>([]);

  // Fetch all known authors from existing documents to calculate "Top 5"
  useEffect(() => {
    const fetchAuthorsFromCollection = async (collection: string) => {
      try {
        const r = await fetch(`/api/${collection}?limit=100&depth=0&sort=-updatedAt`);
        const data = await r.json();
        return (data.docs ?? []).flatMap((doc: { authors?: string }) => 
          parseAuthorsString(doc.authors ?? "")
        );
      } catch (e) {
        console.error(`Error fetching authors from ${collection}`, e);
        return [];
      }
    };

    const loadData = async () => {
      const [tesselaAuthors, moduleAuthors] = await Promise.all([
        fetchAuthorsFromCollection("tesselas"),
        fetchAuthorsFromCollection("modules")
      ]);

      const allAuthors = [...tesselaAuthors, ...moduleAuthors];
      
      // Calculate frequency
      const counts: Record<string, number> = {};
      allAuthors.forEach(a => {
        counts[a] = (counts[a] || 0) + 1;
      });

      // Sort by frequency, ties by latest occurrence (implied by fetch order)
      const sorted = Object.keys(counts).sort((a, b) => {
        if (counts[b] !== counts[a]) {
          return counts[b] - counts[a];
        }
        return 0; // maintain relative fetch order for "last used"
      });

      setTopAuthors(sorted.slice(0, 5));
    };

    loadData();
  }, []);

  const addAuthor = useCallback((author: string) => {
    const currentAuthors = parseAuthorsString(value ?? "");
    if (currentAuthors.includes(author)) return;
    
    const newValue = value ? `${value.trim()}; ${author}` : author;
    setValue(newValue);
  }, [value, setValue]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "1.5rem" }}>
      {/* Label & Description (from Payload field config usually, but we repeat it here or wrap) */}
      <label style={{ fontSize: "14px", fontWeight: 600, color: "var(--theme-text, #e0e0e0)" }}>
        Autores
      </label>
      
      <input
        type="text"
        value={value ?? ""}
        onChange={(e) => setValue(e.target.value)}
        placeholder='e.g. "Filipe Augusto Santos Rocha; João Silva"'
        style={{
          width: "100%",
          padding: "10px 14px",
          background: "var(--theme-input-bg, #1a1a1a)",
          border: "1px solid var(--theme-border-color, #333)",
          borderRadius: "4px",
          color: "var(--theme-text, #e0e0e0)",
          fontSize: "14px",
          transition: "border-color 0.15s",
          outline: "none"
        }}
        onFocus={(e) => (e.target.style.borderColor = "var(--theme-text, #ccc)")}
        onBlur={(e) => (e.target.style.borderColor = "var(--theme-border-color, #333)")}
      />

      {/* Suggestion Chips */}
      {topAuthors.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
          {topAuthors.map((author) => (
            <button
              key={author}
              type="button"
              onClick={() => addAuthor(author)}
              title={`Adicionar ${author}`}
              style={{
                background: "var(--theme-elevation-100, #222)",
                border: "1px solid var(--theme-border-color, #333)",
                borderRadius: "16px",
                padding: "4px 12px",
                fontSize: "11px",
                cursor: "pointer",
                color: "var(--theme-text-light, #999)",
                fontFamily: "var(--font-mono, monospace)",
                transition: "all 0.15s ease"
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "var(--theme-elevation-200, #333)";
                e.currentTarget.style.color = "var(--theme-text, #e0e0e0)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "var(--theme-elevation-100, #222)";
                e.currentTarget.style.color = "var(--theme-text-light, #999)";
              }}
            >
              + {author}
            </button>
          ))}
        </div>
      )}

      {/* Field description repeated because custom components bypass the default field wrapper if not managed correctly */}
      <p style={{ fontSize: "11px", color: "var(--theme-text-light, #666)", margin: 0 }}>
        Separe múltiplos autores com ponto-e-vírgula. Escreva o nome completo ou abreviado.
      </p>
    </div>
  );
}
