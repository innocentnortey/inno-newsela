// vitest 5's `Assertion` has two type parameters, which jest-dom's own
// augmentation does not match; re-declare it so the matchers type-check.
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";
import "vitest";

declare module "vitest" {
  interface Assertion<R extends void | Promise<void> = void, T = unknown>
    extends TestingLibraryMatchers<unknown, T> {
    __r?: R;
  }
}
