"use client";
import React, { useEffect, useRef, useState } from "react";
import hljs from "highlight.js";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  code?: string | React.ReactNode;
  className?: string;
};

export default function CodeBlock({ code, className }: Props) {
  const preRef = useRef<HTMLPreElement>(null);
  const codeRef = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);

  const lang =
    (className || "").match(/language-([A-Za-z0-9+-]+)/)?.[1] ?? undefined;

  useEffect(() => {
    if (codeRef.current) {
      try {
        hljs.highlightElement(codeRef.current);
      } catch {}
    }
  }, [className, code]);

  const extractText = () => {
    if (typeof code === "string") return code;
    return preRef.current?.innerText ?? "";
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(extractText());
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  return (
    <div className="mx-auto my-6 max-w-3xl">
      <div className="rounded-xl border shadow-sm overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 border-b border-border">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {lang ?? ""}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onCopy}
            aria-label={copied ? "Copiado" : "Copiar código"}
          >
            {copied ? (
              <Check className="w-4 h-4" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </Button>
        </div>
        <pre
          ref={preRef}
          className="overflow-x-auto px-4 py-3 bg-[#f6f8fa] dark:bg-[#0d1117] !m-0"
        >
          <code
            ref={codeRef}
            className={[className, "hljs", "!p-0"].filter(Boolean).join(" ")}
          >
            {typeof code === "string" ? code : (code as any)}
          </code>
        </pre>
      </div>
    </div>
  );
}
