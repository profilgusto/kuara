/**
 * mdx-plugins/rehype-source-lines.ts
 *
 * Rehype plugin that stamps every block-level hast element with a
 * `data-source-line="N"` attribute, taken from the node's own
 * `position.start.line` (preserved from the original Markdown source by remark).
 *
 * This enables the bidirectional goto sync between Monaco editor and preview:
 *   - Preview → Editor: clicking a block finds its data-source-line and posts the
 *     line number to the parent frame, which jumps Monaco's cursor.
 *   - Editor → Preview: the "Sync" button posts the current cursor line; the
 *     preview finds the nearest stamped element and scrolls to it.
 *
 * IMPORTANT: must be registered LAST in the rehypePlugins array so it runs
 * after rehypeMathjax and rehypeSlug have finished restructuring the tree.
 */
import type { Plugin } from "unified";
import type { Root, Element } from "hast";
import { visit } from "unist-util-visit";

/** Block-level HTML tags that are meaningful anchor points. */
const BLOCK_TAGS = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "pre",
  "table",
  "ul",
  "ol",
  "li",
  "div",
  "section",
  "article",
  "figure",
  "figcaption",
  "hr",
]);

const rehypeSourceLines: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, "element", (node: Element) => {
      if (!BLOCK_TAGS.has(node.tagName)) return;

      const line = (node as any).position?.start?.line;
      if (typeof line !== "number") return;

      // Stamp the attribute — safe even if properties is already populated
      node.properties = node.properties ?? {};
      // Only stamp if not already stamped (first visit wins)
      if (!node.properties["data-source-line"]) {
        node.properties["data-source-line"] = String(line);
      }
    });
  };
};

export default rehypeSourceLines;
