import type { Metadata } from "next";
import { AccountArea } from "./AccountArea";

export const metadata: Metadata = {
  title: "Minha área | Kuara",
  // Personal page: nothing here for a search engine.
  robots: { index: false, follow: false },
};

/**
 * The signed-in user's own page: their profile data and the forms to change
 * name and password. Reached from the top-bar user menu (lib/user-menu.ts).
 */
export default function MinhaAreaPage() {
  return <AccountArea />;
}
