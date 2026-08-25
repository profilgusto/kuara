"use client";
/**
 * admin/views/InteractiveLibraryView.tsx
 *
 * The interactive-widget library, at /payload/interativos.
 *
 * Laid out as a grid of thumbnails so it stays readable as widgets accumulate:
 * a card carries only the drawing, the id and the name, and everything else —
 * description, parameters, paste-ready snippet — lives in a modal opened from
 * the card. Browsing what exists and studying one widget are different tasks,
 * and a page that did both at once would grow unusable at a dozen entries.
 *
 * Everything here is compile-time data — `catalog` plus each widget's static
 * preview — so unlike TodosView it fetches nothing and cannot be stale
 * relative to what the MDX pipeline will actually accept.
 *
 * Styling is inline, using Payload's `--theme-*` variables, because the admin
 * layout loads only `@payloadcms/next/css` and `custom.scss` — Tailwind
 * classes do not exist here. That is also why the thumbnails are the widgets'
 * SVG print drawings rather than the live components.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  catalog,
  defaultToken,
  mdxSnippet,
  typeTokens,
  widgetIds,
  type WidgetMeta,
} from "@/components/interactive/catalog";
import { getPreview } from "@/components/interactive/previews";

/* ── Style tokens ───────────────────────────────────────────── */

const border = "1px solid var(--theme-elevation-150, #2a2a2a)";
const muted = "var(--theme-elevation-600, #999)";
const strong = "var(--theme-elevation-1000, #fff)";
const surface = "var(--theme-elevation-50, #161616)";

const mono =
  'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

/* ── Small pieces ───────────────────────────────────────────── */

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <code
      style={{
        fontFamily: mono,
        fontSize: "12px",
        padding: "1px 6px",
        borderRadius: "3px",
        background: "var(--theme-elevation-100, #1e1e1e)",
        color: "var(--theme-elevation-800, #ccc)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </code>
  );
}

/**
 * The catalogue's descriptions are written for the Markdown authoring guide
 * and use backticks for code. The admin renders no Markdown, so without this
 * a parameter reads as "só com `point`", backticks and all.
 */
function Described({ text }: { text: string }) {
  const parts = text.split(/`([^`]+)`/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <Chip key={i}>{part}</Chip>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    // Clipboard access needs a secure context; the admin is same-origin with
    // the site, so http://localhost counts. Failure just leaves the label be.
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      },
      () => setCopied(false),
    );
  }, [text]);

  return (
    <button
      type="button"
      onClick={copy}
      style={{
        border,
        borderRadius: "4px",
        background: copied
          ? "var(--theme-success-500, #2e7d32)"
          : "var(--theme-elevation-100, #1e1e1e)",
        color: copied ? "#fff" : "var(--theme-elevation-800, #ccc)",
        fontSize: "12px",
        padding: "4px 10px",
        cursor: "pointer",
        transition: "background 120ms ease",
      }}
    >
      {copied ? "Copiado!" : "Copiar"}
    </button>
  );
}

/** The widget's own declared defaults — what an author gets with no arguments. */
function defaultProps(meta: WidgetMeta): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, spec] of Object.entries(meta.props)) {
    out[name] = spec.default;
  }
  return out;
}

function Preview({ meta, minHeight }: { meta: WidgetMeta; minHeight: number }) {
  const Drawing = getPreview(meta.id);

  return (
    <div
      style={{
        border,
        borderRadius: "6px",
        // The drawings use ink colours meant for paper; they need a light
        // ground to read against the admin's dark chrome.
        background: "#ffffff",
        padding: "8px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: `${minHeight}px`,
      }}
    >
      {Drawing ? (
        <Drawing {...defaultProps(meta)} />
      ) : (
        <span style={{ color: "#888", fontSize: "12px" }}>
          sem pré-visualização
        </span>
      )}
    </div>
  );
}

/* ── Grid card ──────────────────────────────────────────────── */

function WidgetTile({
  meta,
  onOpen,
}: {
  meta: WidgetMeta;
  onOpen: (el: HTMLButtonElement) => void;
}) {
  const [hover, setHover] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => ref.current && onOpen(ref.current)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        border,
        borderRadius: "8px",
        padding: "12px",
        background: surface,
        cursor: "pointer",
        font: "inherit",
        color: "inherit",
        outline: hover ? "1px solid var(--theme-elevation-300, #444)" : "none",
        transition: "outline-color 120ms ease",
      }}
    >
      <Preview meta={meta} minHeight={120} />
      <div style={{ marginTop: "10px" }}>
        <Chip>{meta.id}</Chip>
        <h2
          style={{
            margin: "6px 0 0",
            fontSize: "15px",
            fontWeight: 600,
            color: strong,
          }}
        >
          {meta.title}
        </h2>
      </div>
    </button>
  );
}

/* ── Detail modal ───────────────────────────────────────────── */

function ParamTable({ meta }: { meta: WidgetMeta }) {
  const entries = Object.entries(meta.props);
  if (entries.length === 0) {
    return (
      <p style={{ color: muted, fontSize: "13px", margin: "12px 0 0" }}>
        Este widget não aceita parâmetros.
      </p>
    );
  }

  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        marginTop: "14px",
        fontSize: "13px",
      }}
    >
      <thead>
        <tr style={{ textAlign: "left", color: muted }}>
          <th style={{ padding: "4px 8px 4px 0", fontWeight: 500 }}>
            Parâmetro
          </th>
          <th style={{ padding: "4px 8px", fontWeight: 500 }}>Tipo</th>
          <th style={{ padding: "4px 8px", fontWeight: 500 }}>Padrão</th>
          <th style={{ padding: "4px 0 4px 8px", fontWeight: 500 }}>
            Descrição
          </th>
        </tr>
      </thead>
      <tbody>
        {entries.map(([name, spec]) => {
          const def = defaultToken(spec);
          return (
            <tr key={name} style={{ borderTop: border }}>
              <td style={{ padding: "6px 8px 6px 0" }}>
                <Chip>{name}</Chip>
              </td>
              <td style={{ padding: "6px 8px" }}>
                {typeTokens(spec).map((t, i) => (
                  <React.Fragment key={t}>
                    {i > 0 && <span style={{ color: muted }}> | </span>}
                    <Chip>{t}</Chip>
                  </React.Fragment>
                ))}
              </td>
              <td style={{ padding: "6px 8px" }}>
                {def === null ? (
                  <span style={{ color: muted }}>—</span>
                ) : (
                  <Chip>{def}</Chip>
                )}
              </td>
              <td
                style={{
                  padding: "6px 0 6px 8px",
                  color: "var(--theme-elevation-800, #ccc)",
                }}
              >
                <Described text={spec.describe} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function WidgetDetail({
  meta,
  onClose,
}: {
  meta: WidgetMeta;
  onClose: () => void;
}) {
  const snippet = mdxSnippet(meta);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = `widget-detail-${meta.id}`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    // Without this the page behind keeps scrolling under the overlay, which
    // loses the reader's place in the grid.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "40px 20px",
        overflowY: "auto",
        zIndex: 100,
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        // The overlay closes on click; the panel must not pass its own clicks
        // up, or selecting the snippet text would dismiss the dialog.
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "760px",
          border,
          borderRadius: "10px",
          background: "var(--theme-elevation-0, #111)",
          padding: "22px",
          outline: "none",
          boxShadow: "0 18px 48px rgba(0, 0, 0, 0.45)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "16px",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <Chip>{meta.id}</Chip>
            <h2
              id={titleId}
              style={{
                margin: "8px 0 0",
                fontSize: "19px",
                fontWeight: 600,
                color: strong,
              }}
            >
              {meta.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{
              border,
              borderRadius: "4px",
              background: "var(--theme-elevation-100, #1e1e1e)",
              color: "var(--theme-elevation-800, #ccc)",
              fontSize: "16px",
              lineHeight: 1,
              padding: "6px 10px",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        <p
          style={{
            margin: "12px 0 16px",
            fontSize: "13.5px",
            lineHeight: 1.6,
            color: "var(--theme-elevation-800, #ccc)",
          }}
        >
          <Described text={meta.description} />
        </p>

        <Preview meta={meta} minHeight={220} />

        <ParamTable meta={meta} />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            marginTop: "18px",
            marginBottom: "6px",
          }}
        >
          <span style={{ fontSize: "12px", color: muted }}>
            Cole no conteúdo MDX do módulo:
          </span>
          <CopyButton text={snippet} />
        </div>

        <pre
          style={{
            margin: 0,
            padding: "12px 14px",
            border,
            borderRadius: "6px",
            background: "var(--theme-elevation-100, #1e1e1e)",
            color: "var(--theme-elevation-900, #e6e6e6)",
            fontFamily: mono,
            fontSize: "12.5px",
            lineHeight: 1.6,
            overflowX: "auto",
          }}
        >
          {snippet}
        </pre>
      </div>
    </div>
  );
}

/* ── View ───────────────────────────────────────────────────── */

export const InteractiveLibraryView: React.FC = () => {
  const ids = widgetIds();
  const [openId, setOpenId] = useState<string | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);

  const open = useCallback((id: string, el: HTMLButtonElement) => {
    openerRef.current = el;
    setOpenId(id);
  }, []);

  const close = useCallback(() => {
    setOpenId(null);
    // Send the caret back where it came from, so keyboard users are not
    // dropped at the top of the document on every close.
    openerRef.current?.focus();
  }, []);

  return (
    <div style={{ padding: "32px", maxWidth: "1100px" }}>
      <h1 style={{ margin: "0 0 6px", fontSize: "24px", color: strong }}>
        Biblioteca de interativos
      </h1>
      <p
        style={{
          margin: "0 0 8px",
          fontSize: "13.5px",
          lineHeight: 1.6,
          color: "var(--theme-elevation-800, #ccc)",
        }}
      >
        Blocos interativos que podem ser inseridos no meio do conteúdo de um
        módulo com a tag <Chip>&lt;Interactive&gt;</Chip>. Cada bloco embute uma
        pequena aplicação — uma cena 3D, um cálculo, um questionário — dentro do
        texto, e imprime como um desenho estático.
      </p>
      <p style={{ margin: "0 0 24px", fontSize: "12.5px", color: muted }}>
        {ids.length}{" "}
        {ids.length === 1 ? "widget disponível" : "widgets disponíveis"}. Clique
        em um card para ver os parâmetros e copiar o trecho MDX. As miniaturas
        são exatamente o que sai na versão impressa.
      </p>

      {ids.length === 0 ? (
        <p style={{ color: muted }}>Nenhum widget registrado ainda.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
            gap: "16px",
          }}
        >
          {ids.map((id) => (
            <WidgetTile
              key={id}
              meta={catalog[id]}
              onOpen={(el) => open(id, el)}
            />
          ))}
        </div>
      )}

      {openId && catalog[openId] && (
        <WidgetDetail meta={catalog[openId]} onClose={close} />
      )}
    </div>
  );
};

export default InteractiveLibraryView;
