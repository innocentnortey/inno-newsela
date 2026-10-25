// NL-90 support: start the real web stack once for the whole integration run; tear it down (and drop the DB) at the end.
import { startStack } from "./real-stack";

export default async function globalSetup(): Promise<() => Promise<void>> {
  const stack = await startStack({ web: true });
  return () => stack.stop();
}
