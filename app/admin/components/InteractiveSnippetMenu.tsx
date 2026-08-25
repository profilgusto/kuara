"use client";
/**
 * admin/components/InteractiveSnippetMenu.tsx
 *
 * The MDX toolbar's "Interativos" control: one button that opens the widget
 * catalogue and inserts the chosen block.
 *
 * A button per widget would have been simpler, but the toolbar already carries
 * some 45 of them and the catalogue is the part meant to grow. A submenu keeps
 * the toolbar's footprint constant, and — because it reads `catalog` directly
 * rather than a hand-copied list — a widget shows up here the moment it is
 * registered, with the same snippet the library view and the authoring guide
 * hand out.
 *
 * Colours are hardcoded rather than taken from Payload's `--theme-*` vars: the
 * toolbar sits against Monaco's `vs-dark`, which does not follow the admin
 * theme, so the menu must match the editor and not the page.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Boxes } from "lucide-react";
import {
  catalog,
  widgetIds,
  type WidgetMeta,
} from "@/components/interactive/catalog";
import { getPreview } from "@/components/interactive/previews";
import { interactiveTemplate } from "./interactive-snippet";

/* ── Style tokens, matched to the toolbar's ─────────────────── */

const SURFACE = "#1e1e1e";
const ITEM = "#2d2d2d";
const EDGE = "#444";
const ACCENT = "#5a8";
const TEXT = "#ccc";

const mono =
  'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

/** The widget's declared defaults — what the drawing should depict. */
function defaultProps(meta: WidgetMeta): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, spec] of Object.entries(meta.props)) {
    out[name] = spec.default;
  }
  return out;
}

/**
 * An `<svg>` with no width/height attribute falls back to 300×150 in HTML, so
 * at thumbnail size the drawing would simply be cropped. A rule beats inline
 * styles here because it has to reach the SVG the preview renders, which this
 * component never touches — and it keeps working for previews that do declare
 * their own dimensions.
 */
const THUMB_CLASS = "kuara-widget-thumb";
const THUMB_CSS = `.${THUMB_CLASS} svg { width: 100%; height: 100%; display: block; }`;

function Thumbnail({ meta }: { meta: WidgetMeta }) {
  const Drawing = getPreview(meta.id);

  return (
    <div
      className={THUMB_CLASS}
      style={{
        flex: "0 0 auto",
        width: "84px",
        height: "42px",
        // The drawings are ink-on-paper; they vanish against the dark toolbar.
        background: "#fff",
        borderRadius: "3px",
        border: `1px solid ${EDGE}`,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {Drawing ? (
        <Drawing {...defaultProps(meta)} />
      ) : (
        <span style={{ color: "#999", fontSize: "9px" }}>sem imagem</span>
      )}
    </div>
  );
}

/* ── Menu ───────────────────────────────────────────────────── */

export interface InteractiveSnippetMenuProps {
  /** Receives the finished MDX block; the field feeds it to `insertSnippet`. */
  onInsert: (template: string) => void;
}

export const InteractiveSnippetMenu: React.FC<InteractiveSnippetMenuProps> = ({
  onInsert,
}) => {
  const ids = widgetIds();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  const choose = useCallback(
    (meta: WidgetMeta) => {
      onInsert(interactiveTemplate(meta));
      // The editor takes focus on insert, so returning it to the trigger here
      // would yank the caret straight back out of the document.
      close(false);
    },
    [onInsert, close],
  );

  // Opening moves focus into the list: a menu reachable by mouse only is a
  // menu the keyboard author cannot use at all.
  useEffect(() => {
    if (open) itemRefs.current[0]?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        close(true);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  const onItemKeyDown = useCallback(
    (event: React.KeyboardEvent, index: number) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      const count = itemRefs.current.length;
      // Wraps, so ArrowUp from the first item reaches the last one.
      itemRefs.current[(index + step + count) % count]?.focus();
    },
    [],
  );

  return (
    <div ref={rootRef} style={{ position: "relative", display: "inline-flex" }}>
      <style>{THUMB_CSS}</style>
      <button
        ref={triggerRef}
        type="button"
        title="Bloco Interativo: escolha um widget da biblioteca do Kuara"
        /* The glyph and caret give the button a meaningless accessible name,
           and `title` never wins over element content — so label it. */
        aria-label="Bloco Interativo"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "3px",
          minWidth: "32px",
          height: "28px",
          padding: "0 8px",
          fontSize: "13px",
          fontWeight: 500,
          background: open ? "#3a3d41" : ITEM,
          color: open ? "#fff" : TEXT,
          border: `1px solid ${open ? ACCENT : EDGE}`,
          borderRadius: "4px",
          cursor: "pointer",
          transition: "all 0.15s ease",
          whiteSpace: "nowrap",
        }}
      >
        <Boxes className="w-4 h-4" />
        <span style={{ fontSize: "9px", lineHeight: 1 }}>▾</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Widgets interativos"
          style={{
            position: "absolute",
            top: "32px",
            left: 0,
            zIndex: 40,
            minWidth: "280px",
            maxHeight: "320px",
            overflowY: "auto",
            padding: "4px",
            background: SURFACE,
            border: `1px solid ${EDGE}`,
            borderRadius: "6px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
          }}
        >
          {ids.length === 0 ? (
            <div style={{ padding: "10px", fontSize: "12px", color: "#888" }}>
              Nenhum widget na biblioteca.
            </div>
          ) : (
            ids.map((id, index) => {
              const meta = catalog[id];
              return (
                <button
                  key={id}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  type="button"
                  role="menuitem"
                  title={meta.description}
                  onClick={() => choose(meta)}
                  onKeyDown={(e) => onItemKeyDown(e, index)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    width: "100%",
                    textAlign: "left",
                    padding: "6px",
                    background: "transparent",
                    border: "1px solid transparent",
                    borderRadius: "4px",
                    cursor: "pointer",
                    font: "inherit",
                    color: TEXT,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = ITEM;
                    e.currentTarget.style.borderColor = EDGE;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.borderColor = "transparent";
                  }}
                >
                  <Thumbnail meta={meta} />
                  <span style={{ minWidth: 0 }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#eee",
                      }}
                    >
                      {meta.title}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontFamily: mono,
                        fontSize: "11px",
                        color: ACCENT,
                      }}
                    >
                      {meta.id}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default InteractiveSnippetMenu;
