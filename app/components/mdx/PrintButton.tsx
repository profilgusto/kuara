"use client";

import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";

// Styles injected at print time to force light-mode rendering.
// We use a dynamically inserted <style> tag rather than @media print in
// globals.css because CSS `!important` in @layer base beats !important in
// unlayered @media print blocks (the cascade reversal for !important layers).
// A <style> injected into <head> last has no layer and is always parsed after
// all other sheets, so its !important rules are definitively highest priority.
//
// Note: html/body background-color is handled via inline style (setProperty)
// in handlePrint rather than here, because inline important beats all
// stylesheet cascade including layered !important — that's what eliminates
// the dark margin area when printing from dark mode.
const PRINT_STYLES = `
@media print {
  /* Color for text (body background handled via inline style in JS) */
  html, body {
    color: hsl(160, 30%, 8%) !important;
  }

  /* Kill dark animated gradient */
  body::before { display: none !important; }

  /* Force every element inside body to use dark inherited text */
  body * { color: inherit !important; }

  /* Restore intentional accent colors */
  a[href], a[href] * { color: hsl(188, 60%, 35%) !important; }

  /* Code blocks stay light-themed */
  .hljs { background: #f5f5f5 !important; color: #333 !important; }

  /* MathJax */
  mjx-container svg { fill: hsl(160, 30%, 8%) !important; }
}
`;

export default function PrintButton() {
  const handlePrint = () => {
    const html = document.documentElement;
    const body = document.body;
    const wasAlreadyLight = html.classList.contains("light");

    // 1. Activate light-mode CSS variables (switches --foreground, --background, etc.)
    html.classList.add("light");

    // 2. Force white backgrounds via inline styles — these bypass all CSS cascade
    //    battles (layers, @media print specificity, etc.) because inline important
    //    is the absolute highest author priority. Needed so the page margins and
    //    body area outside the content container aren't printed dark.
    html.style.setProperty("background", "white", "important");
    body.style.setProperty("background", "white", "important");

    // 3. Inject a last-in-document style tag for pseudo-element and color overrides.
    const styleTag = document.createElement("style");
    styleTag.dataset.kuaraPrint = "1";
    styleTag.textContent = PRINT_STYLES;
    document.head.appendChild(styleTag);

    // 4. Force a synchronous reflow so styles are computed before print captures layout.
    void body.offsetHeight;

    // 5. Restore everything once the print dialog closes.
    const restore = () => {
      if (!wasAlreadyLight) html.classList.remove("light");
      html.style.removeProperty("background");
      body.style.removeProperty("background");
      styleTag.remove();
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);

    window.print();
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handlePrint}
      title="Baixar como PDF"
      className="gap-2"
    >
      <FileDown className="h-4 w-4" />
      <span className="hidden sm:inline text-xs">Baixar PDF</span>
    </Button>
  );
}
