import type { Plugin } from "unified";
import { toString } from "mdast-util-to-string";

type Node = any;
type Parent = { type: string; children: Node[] };

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-") || "slide"
  );
}

const remarkWrapSlides: Plugin = () => {
  return (tree: Node) => {
    if (!tree || tree.type !== "root") return;
    const root = tree as Parent;
    const kids = root.children || [];
    if (!kids.length) return;

    console.log("remarkWrapSlides running! Number of children:", kids.length);

    // Build segments
    const segments: Node[][] = [];
    let current: Node[] = [];

    const push = () => {
      // ensure there's something other than only slidebreaks
      if (current.length) {
        segments.push(current);
        current = [];
      }
    };

    function isSlideBreakComponent(n: Node): boolean {
      if (n.type === "mdxJsxFlowElement" && n.name === "SlideBreak") {
        return true;
      }
      return false;
    }

    function isSlideCoverComponent(n: Node): boolean {
      if (n.type === "mdxJsxFlowElement" && n.name === "SlideCover") {
        return true;
      }
      return false;
    }

    function isSkipBreakComponent(n: Node): boolean {
      return n.type === "mdxJsxFlowElement" && n.name === "SkipBreak";
    }

    let skipNextBreak = false;

    for (const n of kids) {
      // SkipBreak: consume it, set flag, and skip adding it to content
      if (isSkipBreakComponent(n)) {
        skipNextBreak = true;
        continue;
      }

      // Check if this node triggers a slide break
      let shouldBreak = false;

      if (
        n.type === "heading" &&
        (n.depth === 1 || n.depth === 2 || n.depth === 3 || n.depth === 4)
      ) {
        if (skipNextBreak) {
          skipNextBreak = false;
        } else {
          shouldBreak = true;
        }
      } else if (isSlideBreakComponent(n)) {
        shouldBreak = true;
      } else if (n.type === "mdxJsxFlowElement" && n.name === "Slide") {
        // Already wrapped explicit Slide tag? If the user typed it, we break here so we don't double wrap.
        shouldBreak = true;
      }

      if (shouldBreak) {
        push(); // push previous segment
        if (isSlideBreakComponent(n)) {
          // We don't need to include the SlideBreak component in the slide content
          continue;
        }
        current.push(n);
      } else {
        current.push(n);
      }
    }
    push();

    // Generate mdxJsxFlowElement nodes named Slide
    const out: Node[] = [];
    const used = new Set<string>();

    segments.forEach((seg, idx) => {
      const heading =
        seg.find((n: Node) => n.type === "heading" && n.depth === 1) ||
        seg.find((n: Node) => n.type === "heading" && n.depth === 2) ||
        seg.find((n: Node) => n.type === "heading" && n.depth === 3) ||
        seg.find((n: Node) => n.type === "heading" && n.depth === 4);

      const text = heading
        ? toString(heading).trim()
        : idx === 0
          ? "introducao"
          : `slide-${idx + 1}`;

      let base = slugify(text) || `slide-${idx + 1}`;
      if (base === "slide") base = `slide-${idx + 1}`;
      let id = base;
      let counter = 2;
      while (used.has(id)) {
        id = `${base}-${counter++}`;
      }
      used.add(id);

      // Try to extract the closest preceding heading name to name the slide,
      // or just fallback to the current segment's own heading.
      let titleText = text;
      // Look backward in previous segments if this segment doesn't have a title
      if (!heading) {
        for (let k = idx - 1; k >= 0; k--) {
          const prevHeading = segments[k].find(
            (n: Node) =>
              n.type === "heading" &&
              (n.depth === 1 || n.depth === 2 || n.depth === 3 || n.depth === 4),
          );
          if (prevHeading) {
            titleText = toString(prevHeading).trim();
            break;
          }
        }
      }

      // Special case: if the segment is just one item and it's ALREADY a Slide,
      // (from legacy content), just ensure it has data-id.
      if (
        seg.length === 1 &&
        seg[0].type === "mdxJsxFlowElement" &&
        seg[0].name === "Slide"
      ) {
        const existingSlide = seg[0];
        const hasDataId = existingSlide.attributes?.some(
          (attr: any) => attr.name === "data-id",
        );
        if (!hasDataId) {
          existingSlide.attributes = existingSlide.attributes || [];
          existingSlide.attributes.push({
            type: "mdxJsxAttribute",
            name: "data-id",
            value: id,
          });
        }
        const hasDataTitle = existingSlide.attributes?.some(
          (attr: any) => attr.name === "data-title",
        );
        if (!hasDataTitle && titleText) {
          existingSlide.attributes.push({
            type: "mdxJsxAttribute",
            name: "data-title",
            value: titleText,
          });
        }
        const hasIsCover = existingSlide.attributes?.some(
          (attr: any) => attr.name === "isCover",
        );
        if (!hasIsCover && seg.some((n: Node) => isSlideCoverComponent(n))) {
          existingSlide.attributes.push({
            type: "mdxJsxAttribute",
            name: "isCover",
            value: true,
          });
        }
        out.push(existingSlide);
        return;
      }

      const isCover = seg.some((n: Node) => isSlideCoverComponent(n));

      out.push({
        type: "mdxJsxFlowElement",
        name: "Slide",
        attributes: [
          { type: "mdxJsxAttribute", name: "data-id", value: id },
          { type: "mdxJsxAttribute", name: "data-title", value: titleText },
          { type: "mdxJsxAttribute", name: "isCover", value: isCover === true },
        ],
        children: seg,
      });
    });

    console.log("remarkWrapSlides generated", out.length, "slides");

    root.children = out;
  };
};

export default remarkWrapSlides;
