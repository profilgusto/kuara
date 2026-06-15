import { ReactNode } from "react";

/**
 * Colorize — inline MDX component to recolor a span of text.
 *
 * Usage:
 *   <Colorize color="#FFFFFF">texto colorido</Colorize>
 *   <Colorize color="red">texto colorido</Colorize>
 *
 * The `color` prop accepts either a named Kuara color (see KUARA_COLORS) or
 * any raw CSS color value (HEX like "#FF8800", "rgb(...)", a CSS color name).
 */

/**
 * Seven main named colors tuned to the Kuara palette. Mid-tone, saturated
 * values chosen to stay legible on both the dark (#0B1411) and light
 * (#F2F5F1) reading backgrounds. `green` and `cyan` mirror the brand
 * primary/secondary tokens.
 */
export const KUARA_COLORS: Record<string, string> = {
  red: "#E5484D",
  orange: "#E8833A",
  yellow: "#E0B341",
  green: "#3FAF5C", // Kuara primary
  cyan: "#2FA8B8", // Kuara secondary
  blue: "#4078F2",
  magenta: "#C44CC4",
};

/** Names of the available nominal colors, for tooltips/snippets. */
export const KUARA_COLOR_NAMES = Object.keys(KUARA_COLORS);

interface ColorizeProps {
  /** Named Kuara color or any raw CSS color value (HEX, rgb(), name). */
  color?: string;
  children: ReactNode;
}

export default function Colorize({ color = "green", children }: ColorizeProps) {
  const resolved = KUARA_COLORS[color.toLowerCase()] ?? color;
  return <span style={{ color: resolved }}>{children}</span>;
}
