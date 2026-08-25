/**
 * admin/components/interactive-snippet.ts
 *
 * Turns a catalogue entry into the text the MDX toolbar inserts.
 *
 * Separate from `snippet.ts` because the two audiences want different things:
 * the authoring guide and the library view show a *finished* example to read,
 * while the editor wants an example to immediately edit. So this wraps the
 * shared builder with the editor's two conventions — a `${1:…}` placeholder,
 * which `insertSnippet` either fills with the current selection or strips, and
 * the trailing blank line every other toolbar snippet leaves behind.
 *
 * Kept free of React so the template is unit-testable without a DOM.
 */
import { mdxSnippet, type WidgetMeta } from "@/components/interactive/catalog";

/**
 * The caption placeholder. Numbered `1` because `insertSnippet` substitutes
 * the editor's selection into that slot: selecting a paragraph and choosing a
 * widget turns the paragraph into the block's caption.
 */
export const CAPTION_PLACEHOLDER = "${1:Legenda do bloco interativo}";

/** Paste-ready `<Interactive>` block for one widget. */
export function interactiveTemplate(meta: WidgetMeta): string {
  return `${mdxSnippet(meta, { caption: CAPTION_PLACEHOLDER })}\n\n`;
}
