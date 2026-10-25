import { api, ApiError } from "@/lib/api-client";
import type { components } from "@/lib/api-types";
import { COLLAB_DOWN, refusedBanner } from "./copy";

type Issue = components["schemas"]["Issue"];

export async function postTransition(
  lessonId: string,
  body: components["schemas"]["TransitionRequest"],
): Promise<components["schemas"]["TransitionResult"]> {
  const { data } = await api.POST("/lessons/{lessonId}/transitions", { params: { path: { lessonId } }, body });
  if (!data) throw new ApiError({ status: 0, code: "NETWORK", message: "Couldn't reach Lesson Studio. Try again." });
  return data;
}

/** The sentence for a refused Submit. */
export function refusalMessage(e: ApiError): string {
  if (e.code === "COLLAB_UNAVAILABLE") return COLLAB_DOWN;
  if (e.code === "BLOCKED" || e.code === "CONFIRMATION_OPEN") {
    const list = e.details.issues;
    if (Array.isArray(list)) {
      const issues = list as Partial<Issue>[];
      const hit = issues.find((i) => i.level === "blocking" && typeof i.message === "string") ?? issues.find((i) => typeof i.message === "string");
      if (hit?.message) return refusedBanner(`${hit.message.replace(/\.$/, "")} on the stored copy.`);
    }
  }
  return refusedBanner(e.message);
}
