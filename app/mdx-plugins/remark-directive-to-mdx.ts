// mdx-plugins/remark-directive-to-mdx.ts
// Converts remark-directive container directives into MDX JSX elements.
// Supports: :::present-only, :::text-only, :::note, :::warning, :::tip, :::slide
import { visit } from "unist-util-visit";
import type { Plugin } from "unified";

type Node = any;

/**
 * Convert a containerDirective node into an mdxJsxFlowElement.
 * Preserves child nodes and copies directive attributes as JSX attributes.
 */
function toMdxJsx(node: Node, componentName: string) {
  const attrs: any[] = [];

  // Copy directive attributes (e.g., :::slide{layout="two-columns"})
  if (node.attributes && typeof node.attributes === "object") {
    for (const [key, value] of Object.entries(node.attributes)) {
      if (key && value !== undefined) {
        attrs.push({
          type: "mdxJsxAttribute",
          name: key,
          value: String(value),
        });
      }
    }
  }

  node.type = "mdxJsxFlowElement";
  node.name = componentName;
  node.attributes = attrs;
  return node;
}

const remarkDirectiveToMdx: Plugin = () => {
  return (tree: Node) => {
    // Map directive names to React component names
    const nameMap: Record<string, string> = {
      "present-only": "PresentOnly",
      po: "PresentOnly",
      "text-only": "TextOnly",
      to: "TextOnly",
      note: "Callout",
      warning: "Callout",
      tip: "Callout",
      slide: "Slide",
    };

    // Directives that need a `type` attribute injected
    const calloutTypes = new Set(["note", "warning", "tip"]);

    visit(tree, (node: Node) => {
      if (node.type === "containerDirective" && nameMap[node.name]) {
        const originalName = node.name;
        const comp = nameMap[originalName];
        toMdxJsx(node, comp);

        // For callout directives, inject the type as an attribute
        if (calloutTypes.has(originalName)) {
          node.attributes = node.attributes || [];
          node.attributes.push({
            type: "mdxJsxAttribute",
            name: "type",
            value: originalName,
          });
        }
      }
    });
  };
};

export default remarkDirectiveToMdx;
