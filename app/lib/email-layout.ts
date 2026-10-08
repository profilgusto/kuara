/**
 * lib/email-layout.ts — the visual shell shared by every e-mail Kuara sends.
 *
 * A message is built by concatenating the pieces below (paragraph, button,
 * fine print) and wrapping the result in `emailShell`. Colours follow the
 * site's light theme (see `.light` in app/(frontend)/globals.css).
 *
 * Layout is `<table>` with inline styles only: it is what the strictest
 * clients render predictably (desktop Outlook uses Word's engine — no
 * flexbox, no grid, no external `<style>`). Fonts are safe system stacks:
 * the site's own (Fraunces, IBM Plex) cannot load in most clients, so the
 * serif wordmark falls back to Georgia. There is no logo image for the same
 * reason — the site's is an SVG, which Gmail and Outlook refuse to draw.
 *
 * Pure string building: every value interpolated from outside is escaped
 * here, so callers pass plain text and URLs, never markup.
 */

// The site's light theme, resolved to hex (e-mail clients do not do hsl()).
const COLOR = {
  page: "#f2f5f1", // --background
  card: "#ffffff",
  border: "#d0d7d0", // --border
  text: "#0e1b16", // --foreground
  muted: "#51675f", // --muted-foreground
  faint: "#8a9a92",
  primary: "#3faf5c", // --primary
  onPrimary: "#0b1411", // --primary-foreground
};

const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif";

/** The line under the wordmark; also the site's own tagline. */
export const EMAIL_TAGLINE = "Saber irradia de dentro";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A body paragraph, with the standard spacing and colour. */
export function emailParagraph(text: string): string {
  return `<p style="margin:0 0 20px 0;font-size:15px;line-height:1.7;color:${COLOR.text};">${escapeHtml(text)}</p>`;
}

/**
 * The message's single call to action, followed by the bare address for
 * clients that strip buttons or readers who prefer to copy the link.
 */
export function emailButton(url: string, label: string): string {
  const href = escapeHtml(url);
  return `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px 0;">
  <tr>
    <td style="background-color:${COLOR.primary};border-radius:8px;">
      <a href="${href}" style="display:inline-block;padding:12px 28px;font-family:${SANS};font-size:15px;font-weight:700;color:${COLOR.onPrimary};text-decoration:none;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>
<p style="margin:0 0 24px 0;font-size:12px;line-height:1.6;color:${COLOR.muted};">Se o botão não funcionar, copie este endereço no navegador:<br><span style="word-break:break-all;color:${COLOR.muted};">${href}</span></p>`;
}

/** Closing fine print, set apart from the body by a rule. */
export function emailNote(text: string): string {
  return `<p style="margin:0;padding-top:20px;border-top:1px solid ${COLOR.border};font-size:13px;line-height:1.6;color:${COLOR.muted};">${escapeHtml(text)}</p>`;
}

/**
 * Wraps a message body in the page: wordmark, a white card with the site's
 * green along its top edge, and a footer.
 *
 * `title` becomes the heading inside the card. `preview` is the snippet inbox
 * lists show next to the subject; it is hidden in the message itself.
 * `bodyHtml` is trusted markup — build it from the helpers above.
 */
export function emailShell({
  title,
  preview,
  bodyHtml,
}: {
  title: string;
  preview: string;
  bodyHtml: string;
}): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLOR.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLOR.page};padding:40px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr>
          <td style="padding:0 4px 20px 4px;">
            <span style="font-family:${SERIF};font-size:24px;font-weight:700;letter-spacing:-0.01em;color:${COLOR.text};">Kuara</span>
            <span style="font-family:${SANS};font-size:12px;color:${COLOR.muted};padding-left:10px;">${EMAIL_TAGLINE}</span>
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:${COLOR.card};border:1px solid ${COLOR.border};border-top:3px solid ${COLOR.primary};border-radius:10px;">
        <tr>
          <td style="padding:36px 40px 32px 40px;font-family:${SANS};color:${COLOR.text};">
            <h1 style="margin:0 0 20px 0;font-family:${SERIF};font-size:21px;line-height:1.3;font-weight:700;color:${COLOR.text};">${escapeHtml(title)}</h1>
            ${bodyHtml}
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr>
          <td style="padding:18px 4px 0 4px;font-family:${SANS};font-size:12px;line-height:1.6;color:${COLOR.faint};">
            Kuara · Engenharia Mecatrônica · UFSJ<br>
            Mensagem automática — não é preciso responder.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
