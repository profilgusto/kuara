"use client";
import { Loader2 } from "lucide-react";

/**
 * Placeholder shown while a widget's chunk is in flight. Mirrors the
 * PDF viewer's loading state so interactive blocks feel like the rest of Kuara.
 */
export default function WidgetLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-3 text-muted-foreground">
      <Loader2 size={22} className="animate-spin text-primary" />
      <span className="text-sm">Carregando interativo…</span>
    </div>
  );
}
