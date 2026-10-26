import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RegenerateButton } from "@/features/workspace/actions/regenerate-panel";
import { REGEN_NO_RUN } from "@/features/workspace/actions/copy";
import { ApiError } from "@/lib/api-client";
import { AnnounceProvider } from "@/lib/announce";

const POST = vi.fn();
vi.mock("@/lib/api-client", async (orig) => ({ ...(await orig<typeof import("@/lib/api-client")>()), api: { POST: (...a: unknown[]) => POST(...a), GET: vi.fn() } }));
afterEach(cleanup);

async function submitWith(e: ApiError) {
  POST.mockReset().mockRejectedValue(e);
  const lesson = { lesson_id: "G6.U4.L4" } as never;
  render(
    <AnnounceProvider>
      <RegenerateButton lesson={lesson} unitKey="g6-u4" lessonKey="L4" onChanged={vi.fn()} />
    </AnnounceProvider>,
  );
  await userEvent.click(screen.getByRole("button", { name: "Regenerate…" }));
  await userEvent.click(screen.getByRole("button", { name: "Regenerate" }));
}

describe("regenerate errors", () => {
  it("no generation run names the missing run", async () => {
    await submitWith(new ApiError({ status: 404, code: "NOT_FOUND", message: "Lesson not found.", details: { reason: "no_generation_run" } }));
    expect(await screen.findByText(REGEN_NO_RUN)).toBeTruthy();
    expect(screen.queryByText("Lesson not found.")).toBeNull();
  });
  it("other NOT_FOUND keeps the server message", async () => {
    await submitWith(new ApiError({ status: 404, code: "NOT_FOUND", message: "Lesson not found." }));
    expect(await screen.findByText("Lesson not found.")).toBeTruthy();
  });
});
