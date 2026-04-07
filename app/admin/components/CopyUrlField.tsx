"use client";

import React, { useState, useEffect } from "react";
import { useFormFields, useDocumentInfo } from "@payloadcms/ui";

export default function CopyUrlField() {
  const [copied, setCopied] = useState(false);
  const [courseSlug, setCourseSlug] = useState<string | null>(null);

  const { collectionSlug } = useDocumentInfo();
  const slug = useFormFields(([fields]) => fields.slug?.value as string);
  const courseValue = useFormFields(([fields]) => fields.course?.value as any);

  useEffect(() => {
    // Only resolve course slug if we're dealing with a module
    if (collectionSlug !== "modules") return;
    
    if (courseValue) {
      if (typeof courseValue === "string" || typeof courseValue === "number") {
        fetch(`/api/courses/${courseValue}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.slug) setCourseSlug(data.slug);
          })
          .catch(() => {});
      } else if (typeof courseValue === "object" && courseValue.slug) {
        setCourseSlug(courseValue.slug);
      }
    } else {
      setCourseSlug(null);
    }
  }, [courseValue, collectionSlug]);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  let fullUrl = "";
  if (collectionSlug === "modules") {
    if (!slug || !courseSlug) {
      fullUrl = "Selecione uma disciplina e aguarde o carregamento...";
    } else {
      fullUrl = `${baseUrl}/disciplinas/${courseSlug}/${slug}`;
    }
  } else {
    // defaults to tesselas
    if (!slug) {
      fullUrl = "Preencha o slug para gerar o link";
    } else {
      fullUrl = `${baseUrl}/tesselas/${slug}`;
    }
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!fullUrl.startsWith("http")) return;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const isPlaceholder = !fullUrl.startsWith("http");

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <label
        style={{
          display: "block",
          fontSize: "13px",
          fontWeight: 600,
          color: "var(--theme-text, #e0e0e0)",
          marginBottom: "6px",
        }}
      >
        Link Público
      </label>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 12px",
          background: "var(--theme-elevation-100, #1a1a1a)",
          border: "1px solid var(--theme-border-color, #333)",
          borderRadius: "4px",
          maxWidth: "100%",
        }}
      >
        <div
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            color: isPlaceholder ? "var(--theme-error-500, #ff6b6b)" : "var(--theme-text-light, #999)",
            fontSize: "13px",
            fontFamily: "monospace",
          }}
        >
          {fullUrl}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          disabled={isPlaceholder}
          title="Copiar Link"
          style={{
            padding: "4px 10px",
            fontSize: "12px",
            fontWeight: 500,
            fontFamily: "inherit",
            cursor: isPlaceholder ? "not-allowed" : "pointer",
            border: "1px solid",
            borderColor: copied
              ? "transparent"
              : "var(--theme-elevation-200, #444)",
            borderRadius: "4px",
            background: copied
              ? "var(--theme-success-500, #28a745)"
              : "var(--theme-elevation-200, #2a2a2a)",
            color: copied
              ? "var(--theme-base-800, #fff)"
              : isPlaceholder ? "var(--theme-elevation-400, #666)" : "var(--theme-text, #e0e0e0)",
            transition: "all 0.2s ease",
            whiteSpace: "nowrap",
          }}
        >
          {copied ? "✓ Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
