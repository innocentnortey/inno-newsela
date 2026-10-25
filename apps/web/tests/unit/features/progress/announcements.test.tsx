import { useEffect } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  describeChanges,
  useRateLimitedAnnounce,
} from "@/features/progress/announcements";
import { progress, tile } from "./fixtures";

const announce = vi.fn();
vi.mock("@/lib/announce", () => ({ useAnnounce: () => announce }));

describe("describeChanges", () => {
  const base = progress("running", [
    tile(4, "drafting"),
    tile(5, "queued"),
    tile(7, "queued"),
  ]);
  it("says nothing on the first load", () => {
    expect(describeChanges(undefined, base)).toEqual([]);
  });
  it("names a lesson that turned ready", () => {
    expect(
      describeChanges(
        base,
        progress("running", [
          tile(4, "ready"),
          tile(5, "queued"),
          tile(7, "queued"),
        ]),
      ),
    ).toEqual(["Lesson 4 is ready"]);
  });
  it("joins several", () => {
    const next = progress("running", [
      tile(4, "ready"),
      tile(5, "ready"),
      tile(7, "ready"),
    ]);
    expect(describeChanges(base, next)).toEqual([
      "Lessons 4, 5 and 7 are ready",
    ]);
  });
  it("ignores in-between tile states", () => {
    expect(
      describeChanges(
        base,
        progress("running", [
          tile(4, "checking"),
          tile(5, "queued"),
          tile(7, "queued"),
        ]),
      ),
    ).toEqual([]);
  });
  it("says the run state change", () => {
    const done = progress("complete", [
      tile(4, "ready"),
      tile(5, "ready"),
      tile(7, "ready"),
    ]);
    const prev = progress("running", [
      tile(4, "ready"),
      tile(5, "ready"),
      tile(7, "ready"),
    ]);
    expect(describeChanges(prev, done)).toEqual([
      "Run complete: 3 of 3 ready.",
    ]);
    expect(describeChanges(prev, progress("paused", done.tiles))).toEqual([
      "Run paused.",
    ]);
  });
});

const box: { say: (m: string[]) => void } = { say: () => {} };
function Probe() {
  const say = useRateLimitedAnnounce(5000);
  useEffect(() => {
    box.say = say;
  });
  return null;
}

describe("useRateLimitedAnnounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    announce.mockClear();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });
  it("announces one now and defers the next to the 5 s mark", () => {
    render(<Probe />);
    act(() => box.say(["a"]));
    act(() => box.say(["b"]));
    act(() => box.say(["c"]));
    expect(announce.mock.calls).toEqual([["a"]]);
    act(() => void vi.advanceTimersByTime(5000));
    expect(announce.mock.calls).toEqual([["a"], ["c"]]);
  });
  it("announces nothing after unmount", () => {
    const { unmount } = render(<Probe />);
    act(() => box.say(["a"]));
    act(() => box.say(["b"]));
    unmount();
    act(() => void vi.advanceTimersByTime(10000));
    expect(announce.mock.calls).toEqual([["a"]]);
  });
});
