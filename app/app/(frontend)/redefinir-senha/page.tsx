import type { Metadata } from "next";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Definir senha | Kuara",
  // The URL carries a one-time token; keep it out of search indexes.
  robots: { index: false, follow: false },
};

/**
 * Landing page for the link in the "set your password" e-mail
 * (lib/account-emails.ts) — used both to recover a password and to choose
 * the first one after an account request is approved.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  return <ResetPasswordForm token={typeof token === "string" ? token : ""} />;
}
