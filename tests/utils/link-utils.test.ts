import { describe, it, expect } from "vitest";
import { toWikilink, parseWikilink, normalizeToName, linkToDisplayName } from "../../src/utils/link-utils";

describe("link-utils", () => {
  describe("toWikilink", () => {
    it("wraps a name in wikilink brackets", () => {
      expect(toWikilink("My Project")).toBe("[[My Project]]");
    });
  });

  describe("parseWikilink", () => {
    it("parses a simple wikilink", () => {
      expect(parseWikilink("[[Foo]]")).toEqual({ path: "Foo", display: null });
    });

    it("parses a wikilink with display text", () => {
      expect(parseWikilink("[[projects/Foo|Foo Display]]")).toEqual({
        path: "projects/Foo",
        display: "Foo Display",
      });
    });

    it("returns null for non-wikilinks", () => {
      expect(parseWikilink("not a link")).toBeNull();
      expect(parseWikilink("")).toBeNull();
    });
  });

  describe("normalizeToName", () => {
    it("extracts name from a DataviewLink object", () => {
      expect(normalizeToName({ path: "clients/Acme Corp.md" })).toBe("Acme Corp");
    });

    it("extracts name from a wikilink string", () => {
      expect(normalizeToName("[[Acme Corp]]")).toBe("Acme Corp");
    });

    it("extracts name from a path string", () => {
      expect(normalizeToName("clients/Acme Corp.md")).toBe("Acme Corp");
    });

    it("handles plain name", () => {
      expect(normalizeToName("Acme Corp")).toBe("Acme Corp");
    });

    it("returns null for null/undefined", () => {
      expect(normalizeToName(null)).toBeNull();
      expect(normalizeToName(undefined)).toBeNull();
    });

    it("returns null for a DataviewLink with empty path", () => {
      expect(normalizeToName({ path: "" })).toBeNull();
    });

    it("returns null for an empty string", () => {
      expect(normalizeToName("")).toBeNull();
    });

    it("extracts name from a DataviewLink with nested path", () => {
      expect(normalizeToName({ path: "clients/Acme.md" })).toBe("Acme");
    });

    it("handles nested path in wikilink", () => {
      expect(normalizeToName("[[projects/My Project]]")).toBe("My Project");
    });
  });

  describe("linkToDisplayName", () => {
    it("returns a display name for a DataviewLink", () => {
      expect(linkToDisplayName({ path: "people/John Smith.md" })).toBe("John Smith");
    });

    it("falls back to string representation for unknown format", () => {
      expect(linkToDisplayName("Unknown")).toBe("Unknown");
    });
  });
});
