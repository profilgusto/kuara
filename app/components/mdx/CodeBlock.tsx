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
      <div className="relative rounded-xl border shadow-sm bg-zinc-50 dark:bg-zinc-900">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1 h-7 w-7"
          onClick={onCopy}
          aria-label={copied ? "Copiado" : "Copiar código"}
        >
          {copied ? (
            <Check className="w-4 h-4" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </Button>
        {lang && (
          <span className="absolute left-3 top-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            {lang}
          </span>
        )}
        <pre
          ref={preRef}
          className="overflow-x-auto p-4 pt-7 rounded-md bg-[#f6f8fa] dark:bg-[#0d1117]"
        >
          <code
            ref={codeRef}
            className={[className, "hljs"].filter(Boolean).join(" ")}
          >
            {typeof code === "string" ? code : (code as any)}
          </code>
        </pre>
      </div>
    </div>
  );
}
