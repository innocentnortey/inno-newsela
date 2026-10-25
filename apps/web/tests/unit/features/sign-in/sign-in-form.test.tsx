import { act, fireEvent, render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignInForm } from "@/features/sign-in/sign-in-form";
import { ApiError } from "@/lib/api-client";
import { AnnounceProvider } from "@/lib/announce";
import { SESSIONS } from "@/test-utils/fixtures";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
const POST = vi.fn();
vi.mock("@/lib/api-client", async (orig) => ({ ...(await orig<typeof import("@/lib/api-client")>()), api: { POST: (...a: unknown[]) => POST(...a) } }));

const setup = (next?: string) => render(<AnnounceProvider><SignInForm next={next} /></AnnounceProvider>);
const fill = async () => {
  await userEvent.type(screen.getByLabelText("Staff email"), "someone@example.org");
  await userEvent.type(screen.getByLabelText("Password"), "pw");
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
};
const err = (code: "NOT_ON_ALLOW_LIST" | "INVALID_CREDENTIALS" | "NETWORK") =>
  new ApiError({ status: code === "NETWORK" ? 0 : 401, code, message: "x" });

beforeEach(() => {
  replace.mockReset();
  POST.mockReset();
});
afterEach(() => vi.useRealTimers());

afterEach(cleanup);

describe("SignInForm", () => {
  it("labels and autocomplete", () => {
    setup();
    expect(screen.getByLabelText("Staff email")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "current-password");
  });

  it("allows pasting", async () => {
    setup();
    const input = screen.getByLabelText("Staff email");
    input.focus();
    await userEvent.paste("pasted@example.org");
    expect(input).toHaveValue("pasted@example.org");
    const ev = new Event("paste", { bubbles: true, cancelable: true });
    fireEvent(input, ev);
    expect(ev.defaultPrevented).toBe(false);
  });

  it("not on the staff list: sentence on the email field, value kept, focus there", async () => {
    POST.mockRejectedValue(err("NOT_ON_ALLOW_LIST"));
    setup();
    await fill();
    const email = screen.getByLabelText("Staff email");
    const sentence = "This email is not on the staff list. Check the spelling or ask your content lead to add you.";
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById(email.getAttribute("aria-describedby")!.split(" ").pop()!)).toHaveTextContent(sentence);
    expect(email).toHaveValue("someone@example.org");
    expect(document.activeElement).toBe(email);
  });

  it("invalid credentials: sentence on the password field, focus there", async () => {
    POST.mockRejectedValue(err("INVALID_CREDENTIALS"));
    setup();
    await fill();
    const pw = screen.getByLabelText("Password");
    expect(pw).toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById(pw.getAttribute("aria-describedby")!.split(" ").pop()!)).toHaveTextContent("That email and password don't match.");
    expect(document.activeElement).toBe(pw);
    expect(screen.getByLabelText("Staff email")).toHaveValue("someone@example.org");
  });

  it("network error shows the network sentence", async () => {
    POST.mockRejectedValue(err("NETWORK"));
    setup();
    await fill();
    expect(screen.getByText("Couldn't reach Lesson Studio. Try again.")).toBeInTheDocument();
  });

  it("success lands an author on units and a reviewer on the board, honouring next", async () => {
    POST.mockResolvedValue({ data: SESSIONS.author });
    const { unmount } = setup();
    await fill();
    expect(replace).toHaveBeenLastCalledWith("/units");
    unmount();
    POST.mockResolvedValue({ data: SESSIONS.reviewer });
    setup();
    await fill();
    expect(replace).toHaveBeenLastCalledWith("/units/g6-u4/board");
  });

  it("honours a safe next and ignores an off-site one", async () => {
    POST.mockResolvedValue({ data: SESSIONS.author });
    const { unmount } = setup("/units/g6-u4/board");
    await fill();
    expect(replace).toHaveBeenLastCalledWith("/units/g6-u4/board");
    unmount();
    setup("https://evil.example");
    await fill();
    expect(replace).toHaveBeenLastCalledWith("/units");
  });

  it("loading: busy at once, spinner only after 250 ms", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    POST.mockReturnValue(new Promise(() => {}));
    setup();
    fireEvent.change(screen.getByLabelText("Staff email"), { target: { value: "a@example.org" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "pw" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    const button = screen.getByRole("button", { name: "Sign in" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(document.querySelector("[data-spinner]")).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(document.querySelector("[data-spinner]")).not.toBeNull();
  });
});
