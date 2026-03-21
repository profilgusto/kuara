"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );

    const el = containerRef.current;
    if (el) {
      el.querySelectorAll(".reveal").forEach((child) =>
        observer.observe(child),
      );
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative min-h-[100dvh] flex items-center justify-start pt-24 pb-16 px-6"
    >
      {/* Ambient glow */}
      <div
        className="absolute top-1/3 left-1/4 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(63,175,92,0.07) 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />

      <div className="relative max-w-7xl mx-auto w-full">
        {/* Status badge */}
        <div
          className="reveal flex items-center gap-2 mb-8 opacity-0"
          style={{ animationDelay: "50ms" }}
        >
          <span className="flex items-center gap-1.5 text-xs font-mono text-primary-DEFAULT border border-primary-DEFAULT/40 rounded-full px-3 py-1 bg-primary-DEFAULT/5">
            <Activity size={11} className="animate-pulse" />
            Monitoramento Ativo · 75 sensores online
          </span>
        </div>

        {/* Headline */}
        <h1
          className="reveal text-display-xl font-serif font-semibold leading-[1.05] tracking-tight text-foreground max-w-3xl opacity-0"
          style={{ animationDelay: "100ms" }}
        >
          Tecnologias para{" "}
          <span className="text-primary-DEFAULT">Ecossistemas</span> Vivos
        </h1>

        {/* Subtitle */}
        <p
          className="reveal mt-6 text-lg text-muted-foreground max-w-[60ch] leading-[1.7] opacity-0"
          style={{ animationDelay: "180ms" }}
        >
          Exploramos o monitoramento e a compreensão de florações naturais com
          sensores de precisão, aprendizado de máquina e análise ambiental em
          tempo real.
        </p>

        {/* CTAs */}
        <div
          className="reveal flex flex-wrap gap-4 mt-10 opacity-0"
          style={{ animationDelay: "260ms" }}
        >
          <Button
            size="lg"
            className="group border border-primary-DEFAULT text-primary-DEFAULT bg-transparent hover:bg-primary-DEFAULT hover:text-bg-base transition-all duration-240 hover:shadow-[0_0_20px_0_rgba(63,175,92,0.3)] active:scale-[0.98]"
            asChild
          >
            <Link href="#pesquisa">
              Explorar Pesquisas
              <ArrowRight
                size={16}
                className="ml-2 transition-transform duration-240 group-hover:translate-x-1"
              />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground transition-colors duration-240"
            asChild
          >
            <Link href="#sobre">Quem somos</Link>
          </Button>
        </div>

        {/* Scroll hint */}
        <div
          className="reveal absolute bottom-10 left-6 md:left-1/2 md:-translate-x-1/2 opacity-0 hidden md:flex flex-col items-center gap-2"
          style={{ animationDelay: "500ms" }}
          aria-hidden="true"
        >
          <span className="text-xs font-mono text-organic tracking-widest uppercase">
            scroll
          </span>
          <div className="w-px h-8 bg-gradient-to-b from-organic/60 to-transparent" />
        </div>
      </div>
    </section>
  );
}
