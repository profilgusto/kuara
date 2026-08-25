"use client";
import React from "react";
import { AlertOctagon } from "lucide-react";

/**
 * Keeps a broken widget from taking the whole module page down.
 *
 * Module pages are `force-dynamic` server components: an unguarded throw
 * inside one client widget escalates to the route's error.tsx and the student
 * loses the entire lesson. Containing the failure to its own box means the
 * rest of the content still reads.
 */
export default class WidgetErrorBoundary extends React.Component<
  { title: string; children: React.ReactNode },
  { message: string | null }
> {
  state: { message: string | null } = { message: null };

  static getDerivedStateFromError(error: unknown) {
    return {
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown) {
    console.error("[interactive] widget falhou:", this.props.title, error);
  }

  render() {
    if (this.state.message === null) return this.props.children;

    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
        <AlertOctagon className="h-5 w-5 text-destructive" />
        <p className="text-sm font-medium text-destructive">
          Este elemento interativo não pôde ser carregado.
        </p>
        <p className="max-w-md text-xs text-muted-foreground break-words">
          {this.state.message}
        </p>
      </div>
    );
  }
}
