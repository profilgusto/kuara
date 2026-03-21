"use client";

import { useViewMode, setViewMode } from "./useViewMode";
import { useEffect, useState } from "react";
import { NotebookText, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ViewToggle() {
  const mode = useViewMode();
  const [show, setShow] = useState(false);

  // Only show on md+ screens
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setShow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  if (!show) return null;

  const next = mode === "apresentacao" ? "texto" : "apresentacao";
  const title = mode === "apresentacao" ? "Modo texto" : "Modo apresentação";
  const Icon = mode === "apresentacao" ? NotebookText : Presentation;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setViewMode(next)}
      title={title}
      className="gap-2"
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline text-xs">{title}</span>
    </Button>
  );
}
