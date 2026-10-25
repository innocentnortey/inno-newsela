import type { Sha256, SheetKind } from "./common.ts";

export interface FetchedSheet {
  url: string;
  kind: SheetKind;
  data: Uint8Array;
  sha256: Sha256;
  fetched_at: Date;
}

export interface SheetFetcher {
  // raises DomainRefusal(SHEET_NOT_PUBLIC) on a sign-in redirect or 401/403; one GET, no retry
  fetch_export(sheet_url: string): Promise<FetchedSheet>;
}
