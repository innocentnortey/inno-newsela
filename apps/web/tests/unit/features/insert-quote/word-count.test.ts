import { describe, expect, it } from "vitest";
import { countWords } from "@/features/insert-quote/word-count";

describe("countWords", () => {
  it("counts tokens with a letter or digit", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("a  b")).toBe(2);
    expect(countWords("- — ...")).toBe(0);
    expect(countWords("don't stop")).toBe(2);
    expect(countWords("The cat sat quietly on the warm window sill")).toBe(9);
    expect(countWords("The cat sat quietly on the warm window sill and then it left")).toBe(13);
  });
});
