/**
 * lib/user-menu.ts — what the top-bar user menu shows for each role.
 *
 * Kept out of the component so the role → links mapping is unit-testable.
 */

export interface MenuLink {
  label: string;
  href: string;
  /**
   * The Payload admin is a separate route group with its own root layout, so
   * it needs a full page load rather than a client-side transition.
   */
  external?: boolean;
}

export function roleLabel(role: string | null | undefined): string {
  switch (role) {
    case "admin":
      return "Administrador";
    case "professor":
      return "Professor";
    case "student":
      return "Aluno";
    default:
      return "Usuário";
  }
}

/**
 * Areas a signed-in user can open, in display order. Everyone gets their own
 * account page; the admin also gets the Payload panel.
 */
export function menuLinksForRole(role: string | null | undefined): MenuLink[] {
  const links: MenuLink[] = [{ label: "Minha área", href: "/minha-area" }];
  if (role === "admin") {
    links.push({ label: "Painel Payload", href: "/payload", external: true });
  }
  return links;
}
