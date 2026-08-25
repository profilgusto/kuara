"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ErrorBoundary:aluno]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-4 text-center">
      <h2 className="text-xl font-semibold text-foreground">Algo deu errado</h2>
      <p className="text-muted-foreground text-sm max-w-md">
        Ocorreu um erro inesperado. Tente novamente ou entre em contato se o
        problema persistir.
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        Tentar novamente
      </button>
    </div>
  );
}
