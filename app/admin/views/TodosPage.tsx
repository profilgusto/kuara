/**
 * admin/views/TodosPage.tsx
 *
 * Server entry for `/payload/todos`: authenticates, then renders the client
 * view. The more pressing of the two gates — the panel lists unpublished
 * editorial notes, which were readable by anyone with the URL.
 */
import React from "react";
import { UnauthorizedPanel, hasAdminUser, type ViewProps } from "./admin-auth";
import TodosView from "./TodosView";

export default function TodosPage(props: ViewProps) {
  if (!hasAdminUser(props)) {
    return <UnauthorizedPanel view="O painel de pendências" />;
  }
  return <TodosView />;
}
