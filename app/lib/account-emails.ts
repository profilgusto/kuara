/**
 * lib/account-emails.ts — the "set your password" e-mail.
 *
 * One message serves two moments: a user who asked to recover a password, and
 * a newly approved account request (see collections/AccountRequests.ts), whose
 * owner has never chosen one. Both land on /redefinir-senha with a Payload
 * reset token.
 *
 * The look comes from lib/email-layout.ts, shared with any future message.
 *
 * Pure on purpose: the server URL is passed in rather than read from the
 * environment, so the link building is unit-testable.
 */

import {
  emailButton,
  emailNote,
  emailParagraph,
  emailShell,
} from "./email-layout";

/** Lifetime of the link sent when an account request is approved. */
export const WELCOME_LINK_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Absolute URL of the password page for a reset token.
 *
 * `serverUrl` is NEXT_PUBLIC_SERVER_URL, which already carries the basePath
 * in production (https://kuara.ufsj.edu.br/kuara) — so nothing is prefixed
 * here, only a stray trailing slash is dropped.
 */
export function passwordLinkUrl(serverUrl: string, token: string): string {
  const base = serverUrl.replace(/\/+$/, "");
  return `${base}/redefinir-senha?token=${encodeURIComponent(token)}`;
}

export function passwordEmailSubject(welcome: boolean): string {
  return welcome
    ? "Kuara — sua conta foi aprovada"
    : "Kuara — redefinição de senha";
}

export function passwordEmailHtml({
  name,
  token,
  serverUrl,
  welcome,
}: {
  name?: string | null;
  token: string;
  serverUrl: string;
  welcome: boolean;
}): string {
  const url = passwordLinkUrl(serverUrl, token);
  const greeting = name ? `Olá, ${name}.` : "Olá.";

  if (welcome) {
    return emailShell({
      title: "Sua conta foi aprovada",
      preview: "Defina sua senha para começar a usar o Kuara.",
      bodyHtml: [
        emailParagraph(greeting),
        emailParagraph(
          "Sua solicitação de conta no Kuara foi aprovada. Para começar, defina a senha que você vai usar para entrar. O link vale por 7 dias.",
        ),
        emailButton(url, "Definir minha senha"),
        emailNote("Se você não solicitou esta conta, ignore esta mensagem."),
      ].join("\n"),
    });
  }

  return emailShell({
    title: "Redefinição de senha",
    preview: "Use o link para escolher uma nova senha. Ele vale por 1 hora.",
    bodyHtml: [
      emailParagraph(greeting),
      emailParagraph(
        "Recebemos um pedido para redefinir a senha da sua conta no Kuara. Use o botão abaixo para escolher uma nova senha. O link vale por 1 hora.",
      ),
      emailButton(url, "Escolher nova senha"),
      emailNote(
        "Se você não fez este pedido, ignore esta mensagem: sua senha continua a mesma.",
      ),
    ].join("\n"),
  });
}
