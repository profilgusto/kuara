import type { SVGProps } from "react";

/**
 * A "10" with a check mark: grades. In the stroke style of the lucide icons
 * used across the site, which has nothing for this.
 */
export function GradeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M3 6.5 5.5 4.5V14" />
      <ellipse cx="12" cy="9.25" rx="2.75" ry="4.75" />
      <path d="m13 18.5 2.75 2.75L21.5 14.5" />
    </svg>
  );
}
