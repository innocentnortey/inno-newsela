import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CandidateScreen } from "@/features/candidate/candidate-screen";
import { COLLAB, DAY_CAP, DRAFTING, HP5_NOTE } from "@/features/candidate/copy";
import { ApiError } from "@/lib/api-client";
import type { components } from "@/lib/api-types";
import type { Role } from "@/lib/roles";
import { renderWithSession } from "@/test-utils/render-with-session";

const m = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), push: vi.fn() }));
vi.mock("@/lib/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-client")>()),
  api: { GET: m.get, POST: m.post },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: m.push }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/features/frame/breadcrumb", () => ({ useSetBreadcrumb: () => {} }));

type Lesson = components["schemas"]["Lesson"];
type Candidate = components["schemas"]["Candidate"];
const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
const sec = (address: string, name: string, text: string) => ({ address, name, minutes: 5, content: doc(text) });
const lesson = (state: Lesson["state"] = "in_review"): Lesson =>
  ({ lesson_id: "G6.U4.L4", lesson_key: "L4", number: 4, state, sections: [sec("S.A", "Launch", "old A"), sec("S.B", "Look Back", "old B")] }) as unknown as Lesson;
const cand = (o: Partial<Candidate> = {}): Candidate =>
  ({
    candidate_id: "cand-4-4", version_number: 4, status: "ready", adopted: false, failure_reasons: [], cost_usd: 0.1, current_content_hash: "h",
    sections: [sec("S.A", "Launch", "new A"), sec("S.B", "Look Back", "new B")], ...o,
  }) as unknown as Candidate;

function serve(c: Candidate, l: Lesson = lesson()) {
  m.get.mockImplementation((path: string) =>
    Promise.resolve({ data: path.includes("/candidates/") ? c : l }),
  );
}
function show(role: Role = "reviewer") {
  return renderWithSession(<CandidateScreen unitKey="g6-u4" lessonKey="L4" candidateId="cand-4-4" />, role);
}
const rowBtn = (name: string) => screen.findByRole("button", { name: `Adopt this section: ${name}` });
const bodies = () => m.post.mock.calls.map((c) => c[1].body);
const err = (code: ConstructorParameters<typeof ApiError>[0]["code"], status = 409) => new ApiError({ status, code, message: "x" });
const wideMatch = () =>
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: true, media: q, addEventListener: () => {}, removeEventListener: () => {} }));

beforeEach(() => {
  m.get.mockReset();
  m.post.mockReset().mockResolvedValue({ data: { candidate_id: "cand-4-4", audit_id: "a", last_editor: "J. Rivera", content_hash: "h" } });
  m.push.mockReset();
  sessionStorage.clear();
  wideMatch();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("candidate screen", () => {
  it("drafting: shows the sentence and the pill", async () => {
    serve(cand({ status: "drafting", sections: [] }));
    show();
    expect(await screen.findByText(DRAFTING)).toBeTruthy();
    expect(screen.getByText("Drafting")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Adopt/ })).toBeNull();
  });
  it("failed: shows the Look Back sentence", async () => {
    serve(cand({ status: "failed", sections: [], failure_reasons: [{ check: "check_failed", message: "Look Back is 3 minutes (needs 5)" }] }));
    show();
    expect(await screen.findByText("Candidate failed: Look Back is 3 minutes (needs 5). The current lesson is unchanged.")).toBeTruthy();
  });
  it("adopt: section posts the body and marks only that row", async () => {
    serve(cand());
    show();
    await userEvent.click(await rowBtn("Look Back"));
    await waitFor(() => expect(screen.getByText("Adopted by J. Rivera")).toBeTruthy());
    expect(bodies()).toEqual([{ scope: "section", section_address: "S.B" }]);
    expect(screen.getAllByText("Adopted by J. Rivera")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Adopt this section: Launch" })).toBeTruthy();
    expect(screen.getAllByText("Look Back adopted from candidate v4. Logged as your edit.").length).toBeGreaterThan(0);
  });
  it("adopt: whole posts {scope: whole} and navigates", async () => {
    serve(cand());
    show();
    await userEvent.click(await screen.findByRole("button", { name: "Adopt whole candidate" }));
    await waitFor(() => expect(m.push).toHaveBeenCalledWith("/units/g6-u4/lessons/L4"), { timeout: 4000 });
    expect(bodies()).toEqual([{ scope: "whole" }]);
    expect(screen.getAllByText("Candidate v4 adopted. Logged as your edit.").length).toBeGreaterThan(0);
    expect(sessionStorage.getItem("ls.handoff-toast")).toContain("Candidate v4 adopted");
  });
  it("adopt: a second click while busy posts once", async () => {
    serve(cand());
    let release: (v: unknown) => void = () => {};
    m.post.mockReturnValue(new Promise((r) => (release = r)));
    show();
    const b = await rowBtn("Launch");
    await userEvent.dblClick(b);
    expect(m.post).toHaveBeenCalledTimes(1);
    release({ data: { last_editor: "J. Rivera" } });
  });
  it.each([
    ["LESSON_LOCKED", "Lesson 4 is submitted. Withdraw it first to regenerate."],
    ["DAY_CAP_REACHED", DAY_CAP],
    ["COLLAB_UNAVAILABLE", COLLAB],
  ] as const)("errors: %s", async (code, sentence) => {
    serve(cand());
    m.post.mockRejectedValue(err(code));
    show();
    await userEvent.click(await rowBtn("Look Back"));
    expect(await screen.findByText(sentence)).toBeTruthy();
    expect(screen.queryByText(/Adopted by/)).toBeNull();
    expect(m.push).not.toHaveBeenCalled();
  });
  it("errors: INVALID_TRANSITION reloads and shows no sentence", async () => {
    serve(cand());
    m.post.mockRejectedValue(err("INVALID_TRANSITION"));
    show();
    const btn = await rowBtn("Look Back");
    const before = m.get.mock.calls.length;
    await userEvent.click(btn);
    await waitFor(() => expect(m.get.mock.calls.length).toBeGreaterThan(before));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/Adopted by/)).toBeNull();
  });
  it("errors: a failed adopt marks no row", async () => {
    serve(cand());
    m.post.mockRejectedValue(err("COLLAB_UNAVAILABLE", 503));
    show();
    await userEvent.click(await rowBtn("Launch"));
    await screen.findByText(COLLAB);
    expect(screen.queryByText(/Adopted by/)).toBeNull();
    expect(screen.getByRole("button", { name: "Adopt this section: Launch" })).toBeTruthy();
  });
  it.each(["author", "approver"] as const)("roles: %s has no adopt control", async (role) => {
    serve(cand());
    show(role);
    expect(await screen.findByText("new A")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Adopt/ })).toBeNull();
    expect(screen.getByText("Only reviewers adopt candidates")).toBeTruthy();
    expect(screen.getByText("old A")).toBeTruthy();
  });
  it("roles: HP-5 note present for reviewer", async () => {
    serve(cand());
    show();
    expect((await screen.findByTestId("hp5-note")).textContent).toBe(HP5_NOTE);
  });
  it("no adopt controls when: lesson is submitted", async () => {
    serve(cand(), lesson("submitted"));
    show();
    await screen.findByText("new A");
    expect(screen.queryByRole("button", { name: /Adopt/ })).toBeNull();
    expect(screen.getByText("Lesson 4 is submitted. Candidates are read-only.")).toBeTruthy();
  });
});
