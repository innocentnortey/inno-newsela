/** Browser only. NEXT_PUBLIC_COLLAB_URL wins; otherwise the same origin's /collab route. */
export function collab_url(): string {
  const env = process.env.NEXT_PUBLIC_COLLAB_URL;
  if (typeof env === "string" && env !== "") return env;
  return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/collab`;
}
