/**
 * UserMenu.test.tsx — the body of the top-bar user menu.
 *
 * `UserMenuContent` is tested without its popover/sheet shell: that shell is
 * Radix positioning code, which needs layout APIs jsdom does not have. What
 * matters here is which form shows up and what each one sends.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import {
  UserMenuContent,
  type AnonymousView,
  type SessionUser,
} from "./UserMenu";

const router = { push: vi.fn(), refresh: vi.fn() };
let pathname = "/";

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => pathname,
}));

const professor: SessionUser = {
  id: 7,
  name: "Maria Lima",
  email: "maria@ufsj.edu.br",
  role: "professor",
};

const close = vi.fn();
const onSessionChange = vi.fn();

/** Holds the state the real `UserMenu` keeps above the content. */
function Harness({ session }: { session: SessionUser | null | undefined }) {
  const [view, setView] = useState<AnonymousView>("login");
  const [email, setEmail] = useState("");
  return (
    <UserMenuContent
      session={session}
      view={view}
      setView={setView}
      email={email}
      setEmail={setEmail}
      onSessionChange={onSessionChange}
      close={close}
    />
  );
}

function mockFetch(status: number, body: unknown = {}) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Path and parsed JSON body of the single request a test expects. */
function sentRequest(fetchMock: ReturnType<typeof vi.fn>) {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0];
  return { url, body: init.body ? JSON.parse(init.body) : undefined };
}

beforeEach(() => {
  pathname = "/";
  router.push.mockClear();
  router.refresh.mockClear();
  close.mockClear();
  onSessionChange.mockClear();
});

describe("signed out", () => {
  it("shows the login fields with the way to the other two forms", () => {
    render(<Harness session={null} />);
    expect(screen.getByLabelText("E-mail")).toBeTruthy();
    expect(screen.getByLabelText("Senha")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Esqueceu a senha?" }),
    ).toBeTruthy();
    // Sign-up is not public yet: only existing accounts can sign in.
    expect(screen.queryByText(/Solicitar conta/)).toBeNull();
    expect(screen.queryByText(/Ainda não tem conta/)).toBeNull();
  });

  it("does not call the server with an empty form", () => {
    const fetchMock = mockFetch(200);
    render(<Harness session={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(screen.getByRole("alert").textContent).toBe(
      "Informe seu e-mail e sua senha.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("signs in and hands the user up", async () => {
    const fetchMock = mockFetch(200, { user: professor });
    render(<Harness session={null} />);
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: " maria@ufsj.edu.br " },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "segredo123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() =>
      expect(onSessionChange).toHaveBeenCalledWith(professor),
    );
    expect(sentRequest(fetchMock)).toEqual({
      url: "/api/users/login",
      body: { email: "maria@ufsj.edu.br", password: "segredo123" },
    });
    expect(close).toHaveBeenCalled();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("reports wrong credentials without signing in", async () => {
    mockFetch(401, { errors: [{ message: "The email or password is wrong" }] });
    render(<Harness session={null} />);
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "maria@ufsj.edu.br" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "errada" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "E-mail ou senha inválidos.",
    );
    expect(onSessionChange).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it("recovers a password, carrying over the e-mail already typed", async () => {
    const fetchMock = mockFetch(200);
    render(<Harness session={null} />);
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "maria@ufsj.edu.br" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Esqueceu a senha?" }));

    expect(screen.queryByLabelText("Senha")).toBeNull();
    expect((screen.getByLabelText("E-mail") as HTMLInputElement).value).toBe(
      "maria@ufsj.edu.br",
    );
    fireEvent.click(screen.getByRole("button", { name: "Enviar link" }));

    expect((await screen.findByRole("status")).textContent).toContain(
      "Se houver uma conta com maria@ufsj.edu.br",
    );
    expect(sentRequest(fetchMock)).toEqual({
      url: "/api/users/forgot-password",
      body: { email: "maria@ufsj.edu.br" },
    });
  });
});

describe("signed in", () => {
  it("shows who is signed in, with the account page as the only link for a professor", () => {
    render(<Harness session={professor} />);
    expect(screen.getByText("Maria Lima")).toBeTruthy();
    expect(screen.getByText("maria@ufsj.edu.br")).toBeTruthy();
    expect(screen.getByText("Professor")).toBeTruthy();
    const links = screen.getAllByRole("link");
    expect(links.map((a) => a.textContent)).toEqual(["Minha área"]);
    expect(links[0].getAttribute("href")).toBe("/minha-area");
    expect(screen.queryByLabelText("Senha")).toBeNull();
  });

  it("closes the menu when the account page is opened", () => {
    render(<Harness session={professor} />);
    // jsdom cannot follow the link; only the click handler is under test.
    const stay = (event: Event) => event.preventDefault();
    document.addEventListener("click", stay);
    fireEvent.click(screen.getByRole("link", { name: "Minha área" }));
    document.removeEventListener("click", stay);
    expect(close).toHaveBeenCalled();
  });

  it("offers the Payload panel to an admin, after the account page", () => {
    render(<Harness session={{ ...professor, role: "admin" }} />);
    const links = screen.getAllByRole("link");
    expect(links.map((a) => a.textContent)).toEqual([
      "Minha área",
      "Painel Payload",
    ]);
    expect(links[1].getAttribute("href")).toBe("/payload");
  });

  it("signs out and redirects to the home page", async () => {
    pathname = "/disciplinas";
    const fetchMock = mockFetch(200);
    render(<Harness session={professor} />);
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));

    await waitFor(() => expect(onSessionChange).toHaveBeenCalledWith(null));
    expect(sentRequest(fetchMock).url).toBe("/api/users/logout");
    expect(close).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith("/");
    expect(router.refresh).toHaveBeenCalled();
  });
});

describe("before the session is known", () => {
  it("shows neither the login form nor an account", () => {
    render(<Harness session={undefined} />);
    expect(screen.queryByLabelText("E-mail")).toBeNull();
    expect(screen.queryByRole("button", { name: "Sair" })).toBeNull();
  });
});
