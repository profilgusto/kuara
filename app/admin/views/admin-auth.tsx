/**
 * admin/views/admin-auth.tsx
 *
 * Server-side authentication gate for Payload's *custom* root views.
 *
 * Payload does not gate them for us. Its root view resolver
 * (`@payloadcms/next/dist/views/Root`) only redirects for the create-first-user
 * flow and for unknown routes; the built-in views enforce auth themselves,
 * inside their own components. A view registered under
 * `admin.components.views` therefore renders for anyone who knows its URL.
 * What such a visitor then sees is still bounded by the REST API's own access
 * control — an anonymous `/api/modules?draft=true` comes back with published
 * content only, so `/payload/todos` was drawing its chrome over an empty list
 * rather than leaking drafts. The view has no business rendering at all with
 * no session, which is what this fixes.
 *
 * The check runs on the server, so an unauthenticated request never receives
 * the view's data at all — not merely a hidden UI. That also makes it
 * verifiable with `curl`, without a browser session.
 *
 * It renders a panel rather than redirecting: `redirect()` and the app's
 * `basePath` interact badly enough (see `lib/base-path.ts`) that a `<Link>`,
 * which Next prefixes on its own, is the safer of the two — and a deep link
 * that explains itself beats one that silently bounces.
 */
import React from "react";
import Link from "next/link";
import type { AdminViewServerProps } from "payload";

/** Whatever Payload hands a custom view; only the user is of interest here. */
export type ViewProps = Partial<AdminViewServerProps>;

/**
 * True when Payload resolved a logged-in user for this request.
 *
 * Deliberately closed: anything other than a user object present on the
 * request — props missing, `initPageResult` absent because the view was
 * rendered some other way — counts as unauthenticated.
 */
export function hasAdminUser(props: ViewProps | undefined): boolean {
  return Boolean(props?.initPageResult?.req?.user);
}

export function UnauthorizedPanel({ view }: { view: string }) {
  return (
    <div
      style={{
        maxWidth: "560px",
        margin: "64px auto",
        padding: "24px",
        border: "1px solid var(--theme-elevation-150, #2a2a2a)",
        borderRadius: "8px",
        background: "var(--theme-elevation-50, #161616)",
      }}
    >
      <h1
        style={{
          margin: "0 0 8px",
          fontSize: "18px",
          color: "var(--theme-elevation-1000, #fff)",
        }}
      >
        Acesso restrito
      </h1>
      <p
        style={{
          margin: "0 0 16px",
          fontSize: "14px",
          lineHeight: 1.5,
          color: "var(--theme-elevation-600, #999)",
        }}
      >
        {view} faz parte do painel do Kuara. Entre com sua conta para continuar.
      </p>
      <Link
        href="/payload/login"
        style={{
          display: "inline-block",
          padding: "8px 16px",
          borderRadius: "4px",
          background: "var(--theme-elevation-150, #252525)",
          color: "var(--theme-elevation-1000, #fff)",
          fontSize: "14px",
          textDecoration: "none",
        }}
      >
        Ir para o login
      </Link>
    </div>
  );
}
