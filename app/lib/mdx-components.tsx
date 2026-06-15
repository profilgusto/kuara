/**
 * lib/mdx-components.ts
 *
 * Single unified component map for all MDX rendering.
 * Fixes the Telaclass duplication problem where component overrides
 * were defined in 3 separate places.
 */
import Slide from "@/components/mdx/Slide";
import SlideBreak from "@/components/mdx/SlideBreak";
import SkipBreak from "@/components/mdx/SkipBreak";
import SlideCover from "@/components/mdx/SlideCover";
import SlideSecondColumnContent from "@/components/mdx/SlideSecondColumnContent";
import SlideDeck from "@/components/mdx/SlideDeck";
import { PresentOnly, TextOnly } from "@/components/mdx/Only";
import Callout from "@/components/mdx/Callout";
import YouTube from "@/components/mdx/YouTube";
import PDF from "@/components/mdx/PDF";
import KImage from "@/components/mdx/KImage";
import ExternalLink from "@/components/mdx/ExternalLink";
import Download from "@/components/mdx/Download";
import CodeBlock from "@/components/mdx/CodeBlock";
import Question, { Answer, Hint } from "@/components/mdx/Question";
import Comment from "@/components/mdx/Comment";
import Todo from "@/components/mdx/Todo";
import Colorize from "@/components/mdx/Colorize";
import Cite from "@/components/citations/Cite";
import CiteTessela from "@/components/tesselas/CiteTessela";
import CiteModule from "@/components/disciplinas/CiteModule";
import RefFig from "@/components/figures/RefFig";
import MdxH1 from "@/components/mdx/MdxH1";
import type { ComponentType } from "react";

/**
 * Returns the full MDX component map.
 * This is the single source of truth for all custom components
 * available in MDX content.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getMdxComponents(): Record<string, ComponentType<any>> {
  return {
    // Presentation components
    Slide,
    SlideBreak,
    SkipBreak,
    SlideCover,
    SlideSecondColumnContent,
    SlideDeck,
    PresentOnly,
    TextOnly,

    // Content components
    Question,
    Answer,
    Hint,
    Callout,
    YouTube,
    PDF,
    KImage,
    ExternalLink,
    Download,
    Colorize,

    // Invisible author-only blocks
    Comment,
    Todo,

    // Citation
    Cite,

    // Tessela cross-reference
    CiteTessela,

    // Module cross-reference
    CiteModule,

    // Figure cross-reference
    RefFig,

    // H1: prepend a horizontal rule in text mode
    h1: MdxH1,

    // Override p → div to prevent hydration errors when block-level MDX
    // components (Hint, Answer) appear on a line adjacent to plain text.
    // MDX wraps such content in <p>, and a <div> inside <p> is invalid HTML.
    // Using a <div> with the "mdx-p" class lets parent selectors keep their
    // per-context margin overrides (e.g. [&>.mdx-p]:my-1.5 inside Question).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    p: (props: any) => <div className="mdx-p my-[1.25em]" {...props} />,

    // Links always open in a new tab
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    a: (props: any) => <a {...props} target="_blank" rel="noopener noreferrer" />,

    // Code block override
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pre: (props: any) => {
      const child = props.children;
      if (child?.type === "code") {
        return (
          <CodeBlock
            code={child.props.children}
            className={child.props.className}
          />
        );
      }
      return <pre {...props} />;
    },
  };
}
