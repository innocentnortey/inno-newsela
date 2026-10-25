import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { SessionProvider } from "@/features/frame/session-context";
import { AnnounceProvider } from "@/lib/announce";
import type { Role } from "@/lib/roles";
import { SESSIONS } from "./fixtures";

export function renderWithSession(ui: ReactElement, role: Role = "author") {
  const user = SESSIONS[role].user;
  return render(
    <AnnounceProvider>
      <SessionProvider value={{ user, role }}>{ui}</SessionProvider>
    </AnnounceProvider>,
  );
}
