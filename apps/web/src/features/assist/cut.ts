import { FIRED_CUTS } from "@/features/frame/nav";

/** Cut #8 (PD-17): the whole AI assist panel can be dropped. */
export const ASSIST_CUT = 8;

export function assistEnabled(fired: readonly number[] = FIRED_CUTS): boolean {
  return !fired.includes(ASSIST_CUT);
}
