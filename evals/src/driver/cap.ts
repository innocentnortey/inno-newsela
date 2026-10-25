// NL-86 AC-3 (PD-29, R-55): the spend cap is resolved before any request is made.
import { DriverError } from "./types.ts";

export function resolve_cap(args: {
  provider_mode: "real" | "stub";
  cap_arg: string | null;
  env: Record<string, string | undefined>;
}): number {
  const ceiling = Number(args.env["BUILD_SPEND_CEILING_USD"] ?? "75");
  const raw = args.cap_arg ?? args.env["DRIVER_CAP_USD"] ?? null;
  if (raw === null || raw === "") {
    if (args.provider_mode === "stub") return ceiling;
    throw new DriverError("CAP_REFUSED", "a real-provider run needs --cap-usd or DRIVER_CAP_USD");
  }
  const cap = Number(raw);
  if (!Number.isFinite(cap) || cap <= 0) throw new DriverError("CAP_REFUSED", "the cap must be a number above 0");
  if (Number.isFinite(ceiling) && cap > ceiling) throw new DriverError("CAP_REFUSED", `the cap exceeds the spend ceiling ${ceiling}`);
  return cap;
}
