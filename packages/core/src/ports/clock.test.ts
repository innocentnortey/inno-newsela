// NL-12
import { describe, expect, it } from "vitest";
import { FakeClock, SystemClock } from "./clock.ts";

describe("FakeClock", () => {
  it("returns a copy of the current time and moves only on advance", () => {
    const c = new FakeClock(new Date("2026-02-03T04:05:06.000Z"));
    const a = c.now();
    a.setFullYear(1999);
    expect(c.now().toISOString()).toBe("2026-02-03T04:05:06.000Z");
    c.advance(1500);
    expect(c.now().toISOString()).toBe("2026-02-03T04:05:07.500Z");
  });

  it("sleep(500) never resolves before 500 ms of advance in total", async () => {
    const c = new FakeClock();
    let done = false;
    void c.sleep(500).then(() => (done = true));
    c.advance(200);
    await Promise.resolve();
    expect(done).toBe(false);
    c.advance(299);
    await Promise.resolve();
    expect(done).toBe(false);
    c.advance(1);
    await Promise.resolve();
    expect(done).toBe(true);
  });

  it("resolves sleepers in wake order", async () => {
    const c = new FakeClock();
    const order: number[] = [];
    void c.sleep(300).then(() => order.push(300));
    void c.sleep(100).then(() => order.push(100));
    c.advance(1000);
    await Promise.resolve();
    await Promise.resolve();
    expect(order).toEqual([100, 300]);
  });

  it("sleep(0) resolves at once", async () => {
    await expect(new FakeClock().sleep(0)).resolves.toBeUndefined();
  });
});

describe("SystemClock", () => {
  it("reads the wall clock", () => {
    expect(Math.abs(new SystemClock().now().getTime() - Date.now())).toBeLessThan(1000);
  });
});
