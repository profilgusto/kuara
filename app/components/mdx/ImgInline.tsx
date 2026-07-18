/**
 * ImgInline — inline MDX component to embed a small figure flush with the text.
 *
 * Designed for references such as toolbar buttons or icons mentioned mid-sentence,
 * e.g.:
 *   Para salvar o código, clique no botão salvar <ImgInline url="/path/img.png" />
 *   que fica na barra superior esquerda.
 *
 * The image height tracks the surrounding font size (via `em` units), so it always
 * matches the line it sits on. Width is derived automatically from the aspect ratio.
 *
 * Usage:
 *   <ImgInline url="/api/media/file/botao-salvar.png" />
 *   <ImgInline url="/path/img.png" height="1.6em" alt="botão salvar" />
 */

import { resolveMediaUrl } from "@/lib/base-path";

interface ImgInlineProps {
  /** Image source. `url` and `src` are interchangeable. */
  url?: string;
  src?: string;
  /** Accessibility alt text for screen readers. */
  alt?: string;
  /**
   * Visible height of the figure, expressed relative to the surrounding text.
   * Defaults to "1.4em" — slightly taller than the cap height so the figure
   * reads as part of the line without disrupting line spacing. Numbers are
   * treated as `em` multiples (1.4 → "1.4em").
   */
  height?: string | number;
}

export default function ImgInline({
  url,
  src,
  alt = "",
  height = "1.4em",
}: ImgInlineProps) {
  const rawSrc = url || src;
  if (!rawSrc) return null;
  const imageSrc = resolveMediaUrl(rawSrc);

  // Numbers / bare numeric strings are interpreted as `em` multiples so the
  // figure always scales with the surrounding font size.
  const cssHeight =
    typeof height === "number" || /^\d+(\.\d+)?$/.test(String(height))
      ? `${height}em`
      : String(height);

  return (
    <img
      src={imageSrc}
      alt={alt}
      style={{
        height: cssHeight,
        width: "auto",
        display: "inline-block",
        verticalAlign: "text-bottom",
        margin: "0 0.15em",
        borderRadius: "0.2em",
      }}
    />
  );
}
