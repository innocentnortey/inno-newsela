import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.fn();
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));

import Home from "../../../app/page";

describe("home page", () => {
  beforeEach(() => redirect.mockClear());

  it("redirects / to /units", () => {
    Home();
    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith("/units");
  });
});
