"use client";

import { useViewMode } from "./useViewMode";
import type { HTMLAttributes } from "react";

export default function MdxH1(props: HTMLAttributes<HTMLHeadingElement>) {
  const mode = useViewMode();
  return (
    <>
      {mode === "texto" && <hr style={{ marginBottom: "0.5rem" }} />}
      <h1 {...props} />
    </>
  );
}
