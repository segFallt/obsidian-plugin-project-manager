import { describe, it, expect } from "vitest";
import { hashString } from "@/utils/hash-utils";

describe("hashString", () => {
  it("is deterministic for the same input", () => {
    expect(hashString("mode: dashboard")).toBe(hashString("mode: dashboard"));
  });

  it("produces different hashes for different inputs", () => {
    expect(hashString("mode: dashboard")).not.toBe(hashString("mode: by-project"));
    expect(hashString("mode: dashboard")).not.toBe(hashString("mode: dashboard\nid: a"));
  });

  it("returns a compact non-empty base-36 token", () => {
    const h = hashString("mode: dashboard");
    expect(h).toMatch(/^[0-9a-z]+$/);
    expect(h.length).toBeGreaterThan(0);
  });

  it("handles the empty string", () => {
    expect(typeof hashString("")).toBe("string");
  });
});
