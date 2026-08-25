"use client";

import React from "react";
import { useModuleContext } from "./ModuleContext";
import { useViewMode } from "./useViewMode";
import Image from "next/image";
import { resolveMediaUrl } from "@/lib/base-path";

interface SlideCoverProps {
  title?: string;
  subtitle?: string;
  author?: string;
  date?: string;
  backgroundImage?: string;
  backgroundMaskOpacity?: string;
  backgroundMaskBlur?: string;
  logoImage?: string;
}

export default function SlideCover({
  title,
  subtitle,
  author,
  date,
  backgroundImage,
  backgroundMaskOpacity = "0%",
  backgroundMaskBlur = "0px",
  logoImage,
}: SlideCoverProps) {
  const { title: moduleTitle } = useModuleContext();
  const mode = useViewMode();

  if (mode === "texto") return null;

  const displayTitle = title || moduleTitle;

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-center items-center overflow-hidden rounded-2xl bg-background text-foreground m-0 p-0">
      {/* Background Layer */}
      {backgroundImage ? (
        <>
          <Image
            src={resolveMediaUrl(backgroundImage)}
            alt="Capa de Slide"
            fill
            className="object-cover absolute inset-0 z-0"
          />
          {/* Background Mask */}
          <div
            className="absolute inset-0 z-10"
            style={{
              backgroundColor: `rgba(0, 0, 0, ${parseFloat(backgroundMaskOpacity) / 100 || 0})`,
              backdropFilter: `blur(${backgroundMaskBlur})`,
              WebkitBackdropFilter: `blur(${backgroundMaskBlur})`,
            }}
          />
        </>
      ) : (
        <div className="absolute inset-0 z-0 bg-[var(--bg)]" />
      )}

      {/* Content Layer */}
      <div
        className="relative z-20 w-full h-full flex flex-col items-center justify-center p-12 text-center"
        style={{ color: "white" }}
      >
        {logoImage && (
          <div className="absolute top-8 right-8">
            {/* Cannot use next/image blindly without dimensions unless it's layout=fill, so we fallback to img for the logo if size is unknown to keep it small, but here we can give generic dimensions or use width/height if we had them. Just using classic img for simplicity since it's a remote/payload asset */}
            <img
              src={resolveMediaUrl(logoImage)}
              alt="Logo"
              className="max-h-16 w-auto object-contain"
            />
          </div>
        )}

        <div className="flex flex-col justify-center items-center flex-1 w-full max-w-4xl">
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight mb-4 drop-shadow-md !text-white">
            {displayTitle}
          </h1>

          {subtitle && (
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium opacity-90 drop-shadow-md !text-white">
              {subtitle}
            </h2>
          )}
        </div>

        {(author || date) && (
          <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center justify-end space-y-1">
            {author && (
              <p className="text-lg font-medium opacity-80 uppercase tracking-widest !text-white">
                {author}
              </p>
            )}
            {date && (
              <p className="text-base opacity-75 tracking-wider !text-white">
                {date}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
