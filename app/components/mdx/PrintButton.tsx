"use client";

import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrintButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => window.print()}
      title="Baixar como PDF"
      className="gap-2"
    >
      <FileDown className="h-4 w-4" />
      <span className="hidden sm:inline text-xs">Baixar PDF</span>
    </Button>
  );
}
