import type { SVGProps } from "react";

/**
 * Three people side by side, in the stroke style of the lucide icons used
 * across the site. lucide's own "users" shows two; this one is for groups.
 */
export function UsersThreeIcon(props: SVGProps<SVGSVGElement>) {
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
      <circle cx="12" cy="8" r="3" />
      <path d="M7 20v-1.5A4.5 4.5 0 0 1 11.5 14h1a4.5 4.5 0 0 1 4.5 4.5V20" />
      <circle cx="4.5" cy="10" r="2" />
      <path d="M1.5 19v-1a3 3 0 0 1 2.5-2.96" />
      <circle cx="19.5" cy="10" r="2" />
      <path d="M22.5 19v-1a3 3 0 0 0-2.5-2.96" />
    </svg>
  );
}

/** The same group with a plus sign: "add groups". */
export function UsersThreePlusIcon(props: SVGProps<SVGSVGElement>) {
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
      <circle cx="10" cy="10" r="2.75" />
      <path d="M5.5 21v-1.25a4.25 4.25 0 0 1 4.25-4.25h.5a4.25 4.25 0 0 1 4.25 4.25V21" />
      <circle cx="3.75" cy="11.75" r="1.75" />
      <path d="M1.25 20v-.75a2.75 2.75 0 0 1 2.25-2.7" />
      <circle cx="16.25" cy="11.75" r="1.75" />
      <path d="M18.75 20v-.75a2.75 2.75 0 0 0-2.25-2.7" />
      <path d="M20 2.5v5M17.5 5h5" />
    </svg>
  );
}
