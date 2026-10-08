/**
 * AccountArea.test.tsx — the body of /minha-area.
 *
 * `AccountAreaContent` is tested without the session provider: what matters
 * here is what each state shows and what each form sends.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AccountAreaContent } from "./AccountArea";
import type { SessionUser } from "@/components/layout/SessionContext";

const student: SessionUser = {
  id: 12,
  name: "Ana Souza",
  email: "ana@ufsj.edu.br",
  role: "student",
};

const onSessionChange = vi.fn();

function mockFetch(status: number, body: unknown = {}) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Path, method and parsed JSON body of the single request a test expects. */
function sentRequest(fetchMock: ReturnType<typeof vi.fn>) {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0];
  return { url, method: init.method, body: JSON.parse(init.body) };
}

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

beforeEach(() => {
  onSessionChange.mockClear();
});

describe("without a session", () => {
  it("shows no form while the session is unknown", () => {
    render(
      <AccountAreaContent
        session={undefined}
        onSessionChange={onSessionChange}
      />,
    );
    expect(screen.queryByLabelText("Nome")).toBeNull();
    expect(screen.queryByText(/não está logado/)).toBeNull();
  });

  it("tells a signed-out visitor to sign in", () => {
    render(
      <AccountAreaContent session={null} onSessionChange={onSessionChange} />,
    );
    expect(screen.getByText(/Você não está logado/)).toBeTruthy();
    expect(screen.queryByLabelText("Nome")).toBeNull();
    expect(screen.queryByLabelText("Senha atual")).toBeNull();
  });
});

describe("profile", () => {
  it("shows the registered name, e-mail and role", () => {
    render(
      <AccountAreaContent
        session={student}
        onSessionChange={onSessionChange}
      />,
    );
    const profile = screen.getByRole("region", { name: "Perfil" });
    expect(profile.textContent).toContain("Ana Souza");
    expect(profile.textContent).toContain("ana@ufsj.edu.br");
    expect(profile.textContent).toContain("Aluno");
  });
});

describe("changing the name", () => {
  it("keeps the button off until the name differs", () => {
    render(
      <AccountAreaContent
        session={student}
        onSessionChange={onSessionChange}
      />,
    );
    const button = screen.getByRole("button", {
      name: "Salvar nome",
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fill("Nome", " Ana Souza ");
    expect(button.disabled).toBe(true);
    fill("Nome", "Ana S. Lima");
    expect(button.disabled).toBe(false);
  });

  it("saves the trimmed name to the user's own record and hands it up", async () => {
    const fetchMock = mockFetch(200, { doc: { ...student, name: "Ana Lima" } });
    render(
      <AccountAreaContent
        session={student}
        onSessionChange={onSessionChange}
      />,
    );
    fill("Nome", "  Ana Lima ");
    fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));

    expect((await screen.findByRole("status")).textContent).toBe(
      "Nome atualizado.",
    );
    expect(sentRequest(fetchMock)).toEqual({
      url: "/api/users/12",
      method: "PATCH",
      body: { name: "Ana Lima" },
    });
    expect(onSessionChange).toHaveBeenCalledWith({
      ...student,
      name: "Ana Lima",
    });
  });

  it("does not call the server with an empty name", () => {
    const fetchMock = mockFetch(200);
    render(
      <AccountAreaContent
        session={student}
        onSessionChange={onSessionChange}
      />,
    );
    fill("Nome", "   ");
    fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));
    expect(screen.getByRole("alert").textContent).toBe("Informe seu nome.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a refused save without touching the session", async () => {
    mockFetch(500);
    render(
      <AccountAreaContent
        session={student}
        onSessionChange={onSessionChange}
      />,
    );
    fill("Nome", "Ana Lima");
    fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Não foi possível salvar. Tente novamente.",
    );
    expect(onSessionChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("changing the password", () => {
  function fillPasswords(current: string, next: string, confirmation: string) {
    fill("Senha atual", current);
    fill("Nova senha", next);
    fill("Confirme a nova senha", confirmation);
  }

  it("sends the current and the new password, then clears the form", async () => {
    const fetchMock = mockFetch(200, { ok: true });
    render(
      <AccountAreaContent
        session={student}
        onSessionChange={onSessionChange}
      />,
    );
    fillPasswords("antiga123", "nova-senha", "nova-senha");
    fireEvent.click(screen.getByRole("button", { name: "Alterar senha" }));

    expect((await screen.findByRole("status")).textContent).toBe(
      "Senha alterada.",
    );
    expect(sentRequest(fetchMock)).toEqual({
      url: "/api/users/change-password",
      method: "POST",
      body: { currentPassword: "antiga123", newPassword: "nova-senha" },
    });
    await waitFor(() =>
      expect(
        (screen.getByLabelText("Senha atual") as HTMLInputElement).value,
      ).toBe(""),
    );
    expect(
      (screen.getByLabelText("Nova senha") as HTMLInputElement).value,
    ).toBe("");
  });

  it.each([
    ["", "nova-senha", "nova-senha", "Informe sua senha atual."],
    [
      "antiga123",
      "curta",
      "curta",
      "A nova senha precisa ter pelo menos 8 caracteres.",
    ],
    ["antiga123", "nova-senha", "nova-senhx", "As senhas não coincidem."],
    [
      "antiga123",
      "antiga123",
      "antiga123",
      "A nova senha precisa ser diferente da atual.",
    ],
  ])(
    "does not call the server for %j / %j / %j",
    (current, next, confirmation, message) => {
      const fetchMock = mockFetch(200);
      render(
        <AccountAreaContent
          session={student}
          onSessionChange={onSessionChange}
        />,
      );
      fillPasswords(current, next, confirmation);
      fireEvent.click(screen.getByRole("button", { name: "Alterar senha" }));
      expect(screen.getByRole("alert").textContent).toBe(message);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("shows the server's reason and keeps what was typed", async () => {
    mockFetch(403, { error: "A senha atual está incorreta." });
    render(
      <AccountAreaContent
        session={student}
        onSessionChange={onSessionChange}
      />,
    );
    fillPasswords("errada123", "nova-senha", "nova-senha");
    fireEvent.click(screen.getByRole("button", { name: "Alterar senha" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "A senha atual está incorreta.",
    );
    expect(screen.queryByRole("status")).toBeNull();
    expect(
      (screen.getByLabelText("Nova senha") as HTMLInputElement).value,
    ).toBe("nova-senha");
  });
});
