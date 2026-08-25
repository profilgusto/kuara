/**
 * admin/views/InteractiveLibraryPage.tsx
 *
 * Server entry for `/payload/interativos`: authenticates, then renders the
 * client view. Payload's custom root views carry no auth of their own — see
 * `admin-auth.tsx` for why the check has to live here.
 */
import React from "react";
import { UnauthorizedPanel, hasAdminUser, type ViewProps } from "./admin-auth";
import InteractiveLibraryView from "./InteractiveLibraryView";

export default function InteractiveLibraryPage(props: ViewProps) {
  if (!hasAdminUser(props)) {
    return <UnauthorizedPanel view="A biblioteca de widgets interativos" />;
  }
  return <InteractiveLibraryView />;
}
