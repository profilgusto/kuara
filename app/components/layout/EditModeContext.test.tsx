/**
 * EditModeContext.test.tsx — who gets the pencil in the top bar, and when
 * edit mode is on.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { SessionUser } from "./SessionContext";
import { EditModeProvider, useEditablePage } from "./EditModeContext";
import { EditModeButton } from "./EditModeButton";

let session: SessionUser | null | undefined;

vi.mock("./SessionContext", () => ({
  useSession: () => ({ session, setSession: vi.fn() }),
}));

const admin: SessionUser = {
  id: 1,
  name: "Ana",
  email: "ana@ufsj.edu.br",
  role: "admin",
};

function EditablePage() {
  const editing = useEditablePage();
  return <p>{editing ? "editando" : "lendo"}</p>;
}

function App({ editable = true }: { editable?: boolean }) {
  return (
    <EditModeProvider>
      <EditModeButton />
      {editable ? <EditablePage /> : <p>outra página</p>}
    </EditModeProvider>
  );
}

const pencil = () => screen.queryByRole("button", { name: /modo de edição/ });

function turnOn() {
  fireEvent.click(
    screen.getByRole("button", { name: "Ativar modo de edição" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Ativar" }));
}

beforeEach(() => {
  session = admin;
});

describe("the pencil in the top bar", () => {
  it("shows for an admin on an editable page", () => {
    render(<App />);
    expect(pencil()).toBeTruthy();
  });

  it.each([
    ["a visitor", null],
    ["an unknown session", undefined],
    ["a professor", { ...admin, role: "professor" }],
    ["a student", { ...admin, role: "student" }],
  ])("is hidden from %s", (_who, value) => {
    session = value;
    render(<App />);
    expect(pencil()).toBeNull();
    expect(screen.getByText("lendo")).toBeTruthy();
  });

  it("is hidden on a page with nothing to edit", () => {
    render(<App editable={false} />);
    expect(pencil()).toBeNull();
  });
});

describe("a shared component on a page without the tool", () => {
  function ReadOnlyPage() {
    const editing = useEditablePage(false);
    return <p>{editing ? "editando" : "lendo"}</p>;
  }

  it("does not bring up the pencil", () => {
    render(
      <EditModeProvider>
        <EditModeButton />
        <ReadOnlyPage />
      </EditModeProvider>,
    );
    expect(pencil()).toBeNull();
    expect(screen.getByText("lendo")).toBeTruthy();
  });

  it("stays read-only while another part of the page is being edited", () => {
    render(
      <EditModeProvider>
        <EditModeButton />
        <EditablePage />
        <ReadOnlyPage />
      </EditModeProvider>,
    );
    turnOn();
    expect(screen.getByText("editando")).toBeTruthy();
    expect(screen.getByText("lendo")).toBeTruthy();
  });
});

describe("turning edit mode on", () => {
  it("asks first, and does nothing until confirmed", () => {
    render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: "Ativar modo de edição" }),
    );

    expect(
      screen.getByText("Deseja mesmo ativar o modo de edição?"),
    ).toBeTruthy();
    expect(screen.getByText("lendo")).toBeTruthy();
  });

  it("stays off when the question is cancelled", () => {
    render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: "Ativar modo de edição" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.getByText("lendo")).toBeTruthy();
    expect(
      screen.queryByText("Deseja mesmo ativar o modo de edição?"),
    ).toBeNull();
  });

  it("turns on when confirmed, and off again without asking", () => {
    render(<App />);
    turnOn();
    expect(screen.getByText("editando")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Sair do modo de edição" }),
    );
    expect(screen.getByText("lendo")).toBeTruthy();
  });
});

describe("leaving", () => {
  it("switches off on sign-out and does not resume on the next sign-in", () => {
    const { rerender } = render(<App />);
    turnOn();

    session = null;
    rerender(<App />);
    expect(screen.getByText("lendo")).toBeTruthy();
    expect(pencil()).toBeNull();

    session = admin;
    rerender(<App />);
    expect(screen.getByText("lendo")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Ativar modo de edição" }),
    ).toBeTruthy();
  });

  it("switches off when the page is left, even if another editable one follows", () => {
    const { rerender } = render(<App />);
    turnOn();

    rerender(<App editable={false} />);
    rerender(<App />);

    expect(screen.getByText("lendo")).toBeTruthy();
  });
});
