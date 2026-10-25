import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VersionList } from "@/features/history/version-list";
import { version } from "./fixtures";

afterEach(cleanup);
const vs = [1, 2, 3].map((n) =>
  version({ version_number: n, kind: n === 3 ? "submit" : "generated" }),
);

describe("VersionList", () => {
  it("renders an ordered list with a Copy hash button per version", () => {
    render(
      <VersionList versions={vs} audit={[]} selected={3} onSelect={() => {}} />,
    );
    expect(screen.getByRole("list", { name: "Versions" }).tagName).toBe("OL");
    expect(screen.getAllByRole("button", { name: "Copy hash" })).toHaveLength(
      3,
    );
  });
  it("selects a version and shows no durations", () => {
    const onSelect = vi.fn();
    render(
      <VersionList versions={vs} audit={[]} selected={1} onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^v3 · / }));
    expect(onSelect).toHaveBeenCalledWith(3);
    expect(
      screen.getByRole("list", { name: "Versions" }).textContent,
    ).not.toMatch(/\bmin(ute)?s?\b/i);
  });
});
