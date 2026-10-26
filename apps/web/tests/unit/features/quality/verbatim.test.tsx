import { cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QualityScreen } from "@/features/quality/quality-screen";
import * as data from "@/features/quality/data";
import { renderWithSession } from "@/test-utils/render-with-session";
import { metrics, zeroMedian } from "../../../../e2e/quality/fixtures";

vi.mock("@/features/quality/data");
afterEach(cleanup);

describe("verbatim", () => {
  it("prints every number exactly as received and computes nothing", async () => {
    vi.mocked(data.fetchUnitMetrics).mockResolvedValue(metrics());
    const { container } = renderWithSession(<QualityScreen unitKey="g6-u4" />, "reviewer");
    await waitFor(() => expect(screen.getByText("Unit quality")).toBeTruthy());
    const text = container.textContent ?? "";
    for (const s of ["66.7", "0.54", "1.9", "3.4", "Median 31 min", "one reviewer, n = 3", "our reviewers"])
      expect(text).toContain(s);
    expect(text).not.toMatch(/\b80\b|\b0\.8\b/);
    const seeded = screen.getByRole("table", { name: "Seeded-error report" });
    expect(seeded.textContent).toContain("5");
    expect(seeded.textContent).toContain("4");
  });
  it("median 0 prints, null median prints nothing", async () => {
    vi.mocked(data.fetchUnitMetrics).mockResolvedValue(zeroMedian());
    renderWithSession(<QualityScreen unitKey="g6-u4" />, "reviewer");
    await waitFor(() => expect(screen.getByText(/Median 0 min/)).toBeTruthy());
    cleanup();
    const m = metrics();
    vi.mocked(data.fetchUnitMetrics).mockResolvedValue({ ...m, north_star: { ...m.north_star, median_minutes: null } });
    renderWithSession(<QualityScreen unitKey="g6-u4" />, "reviewer");
    await waitFor(() => expect(screen.getByText("Unit quality")).toBeTruthy());
    expect(screen.queryByText(/Median/)).toBeNull();
  });
});
