import { describe, it, expect } from "vitest";
import { isBrowseQuery, normalizeQuery } from "@/services/search-query";
import { EMPTY_QUERY } from "@/constants";

describe("normalizeQuery", () => {
  it("trims leading and trailing whitespace", () => {
    expect(normalizeQuery("  acme \t\n")).toBe("acme");
  });

  it("keeps inner whitespace, so a phrase stays a literal phrase", () => {
    expect(normalizeQuery("  acme  portal  ")).toBe("acme  portal");
  });

  it("normalizes a whitespace-only query to the empty query", () => {
    expect(normalizeQuery("   ")).toBe(EMPTY_QUERY);
  });

  it("leaves an already-trimmed query unchanged", () => {
    expect(normalizeQuery("acme")).toBe("acme");
  });
});

describe("isBrowseQuery", () => {
  it("is true for the empty query", () => {
    expect(isBrowseQuery(EMPTY_QUERY)).toBe(true);
  });

  it("is true for whitespace-only input", () => {
    expect(isBrowseQuery(" \t ")).toBe(true);
  });

  it("is false for a query with text, including surrounding whitespace", () => {
    expect(isBrowseQuery("acme")).toBe(false);
    expect(isBrowseQuery("  acme  ")).toBe(false);
  });
});
