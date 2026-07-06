import { describe, it, expect } from "vitest";
import { parseRaidReferences, isSectionHeadingLine } from "@/processors/raid-reference-parser";
import { DIRECTION_LABELS } from "@/processors/raid-constants";
import type { RaidReferenceEntry } from "@/types";

// ─── Helpers ────────────────────────────────────────────────────────────────

const ITEM = "My Risk";

function parse(content: string, raidType = "Risk" as const, itemName = ITEM): RaidReferenceEntry[] {
  return parseRaidReferences(content, itemName, raidType, DIRECTION_LABELS);
}

function ann(direction: string, item = ITEM): string {
  return `{raid:${direction}}[[${item}]]`;
}

// ─── Line scope (backward compatibility) ──────────────────────────────────────

describe("parseRaidReferences — line scope", () => {
  it("captures a single annotated line, annotation stripped", () => {
    const entries = parse(`We must track this. ${ann("positive")} The team agrees.`);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      scope: "line",
      direction: "positive",
      label: "Mitigates",
      lineText: "We must track this.  The team agrees.",
    });
  });

  it("strips the annotation and trims surrounding whitespace", () => {
    const entries = parse(`   ${ann("negative")}   `);
    expect(entries[0]).toMatchObject({ scope: "line", lineText: "" });
  });

  it("resolves labels by direction and resolved raid-type", () => {
    expect(parse(`x ${ann("negative")}`, "Risk")[0].label).toBe("Escalates");
    expect(parse(`x ${ann("neutral")}`, "Decision")[0].label).toBe("Notes");
    expect(parse(`x ${ann("positive")}`, "Decision")[0].label).toBe("Supports");
  });

  it("captures multiple line-scope annotations across a document", () => {
    const entries = parse(`- one ${ann("positive")}\nsome text\n- two ${ann("negative")}`);
    expect(entries).toHaveLength(2);
    expect(entries.every((e) => e.scope === "line")).toBe(true);
  });

  it("returns an empty array when there are no matching annotations", () => {
    expect(parse(`Just prose, no annotations here.`)).toEqual([]);
    // Annotation for a different item name is ignored
    expect(parse(`text ${ann("positive", "Other Item")}`)).toEqual([]);
  });
});

// ─── Section scope (heading detection & bounds) ──────────────────────────────

describe("parseRaidReferences — section scope", () => {
  it("detects an ATX heading and captures the full body beneath it", () => {
    const content = [
      `## Payment approach ${ann("positive")}`,
      "First paragraph.",
      "",
      "Second paragraph.",
    ].join("\n");
    const entries = parse(content);
    expect(entries).toHaveLength(1);
    const entry = entries[0];
    expect(entry.scope).toBe("section");
    if (entry.scope !== "section") throw new Error("expected section");
    expect(entry.headingText).toBe("## Payment approach");
    expect(entry.bodyMarkdown).toBe("First paragraph.\n\nSecond paragraph.");
    expect(entry.label).toBe("Mitigates");
  });

  it("terminates the section at the next heading of equal level", () => {
    const content = [
      `## Tagged ${ann("neutral")}`,
      "body line",
      "## Sibling",
      "not included",
    ].join("\n");
    const entry = parse(content)[0];
    if (entry.scope !== "section") throw new Error("expected section");
    expect(entry.bodyMarkdown).toBe("body line");
  });

  it("terminates the section at the next heading of higher level", () => {
    const content = [
      `### Tagged ${ann("neutral")}`,
      "body line",
      "# Higher",
      "not included",
    ].join("\n");
    const entry = parse(content)[0];
    if (entry.scope !== "section") throw new Error("expected section");
    expect(entry.bodyMarkdown).toBe("body line");
  });

  it("includes deeper subsections within the tagged section", () => {
    const content = [
      `## Tagged ${ann("positive")}`,
      "intro",
      "### Subsection",
      "sub body",
      "#### Deeper",
      "deeper body",
      "## Sibling",
      "excluded",
    ].join("\n");
    const entry = parse(content)[0];
    if (entry.scope !== "section") throw new Error("expected section");
    expect(entry.bodyMarkdown).toBe(
      ["intro", "### Subsection", "sub body", "#### Deeper", "deeper body"].join("\n")
    );
  });

  it("captures the body all the way to EOF when no following heading exists", () => {
    const content = [`# Tagged ${ann("negative")}`, "line a", "line b"].join("\n");
    const entry = parse(content)[0];
    if (entry.scope !== "section") throw new Error("expected section");
    expect(entry.bodyMarkdown).toBe("line a\nline b");
  });

  it("returns heading only (empty body) for a heading with no content beneath", () => {
    const content = [`## Empty ${ann("neutral")}`, "## Next", "other"].join("\n");
    const entry = parse(content)[0];
    if (entry.scope !== "section") throw new Error("expected section");
    expect(entry.headingText).toBe("## Empty");
    expect(entry.bodyMarkdown).toBe("");
  });

  it("returns heading only for a tagged heading at EOF", () => {
    const entry = parse(`## Solo ${ann("positive")}`)[0];
    if (entry.scope !== "section") throw new Error("expected section");
    expect(entry.bodyMarkdown).toBe("");
  });
});

// ─── Edge cases: fences, front-matter, setext ────────────────────────────────

describe("parseRaidReferences — edge cases", () => {
  it("does not treat a #-prefixed line inside a fenced code block as a heading boundary", () => {
    const content = [
      `## Tagged ${ann("positive")}`,
      "intro",
      "```bash",
      "# this is a shell comment, not a heading",
      "echo hi",
      "```",
      "outro",
      "## Sibling",
      "excluded",
    ].join("\n");
    const entry = parse(content)[0];
    if (entry.scope !== "section") throw new Error("expected section");
    expect(entry.bodyMarkdown).toBe(
      ["intro", "```bash", "# this is a shell comment, not a heading", "echo hi", "```", "outro"].join(
        "\n"
      )
    );
  });

  it("does not treat a #-prefixed fenced line as a section-opening heading", () => {
    const content = ["```", `# ${ann("positive")}`, "```"].join("\n");
    const entry = parse(content)[0];
    // Inside a fence -> not a heading -> falls back to line scope
    expect(entry.scope).toBe("line");
  });

  it("supports tilde-fenced code blocks", () => {
    const content = [
      `## Tagged ${ann("neutral")}`,
      "~~~",
      "# not a heading",
      "~~~",
      "after",
    ].join("\n");
    const entry = parse(content)[0];
    if (entry.scope !== "section") throw new Error("expected section");
    expect(entry.bodyMarkdown).toBe("~~~\n# not a heading\n~~~\nafter");
  });

  it("ignores # values inside leading YAML front-matter", () => {
    const content = [
      "---",
      "tags: ['#raid']",
      "# not a heading",
      "---",
      `## Real heading ${ann("positive")}`,
      "body",
    ].join("\n");
    const entries = parse(content);
    expect(entries).toHaveLength(1);
    const entry = entries[0];
    if (entry.scope !== "section") throw new Error("expected section");
    expect(entry.headingText).toBe("## Real heading");
    expect(entry.bodyMarkdown).toBe("body");
  });

  it("treats a setext heading title as line scope (documented limitation), without crashing", () => {
    const content = [`Setext Title ${ann("positive")}`, "===========", "body"].join("\n");
    const entries = parse(content);
    expect(entries).toHaveLength(1);
    expect(entries[0].scope).toBe("line");
  });
});

// ─── Annotation stripping in section bodies ──────────────────────────────────

describe("parseRaidReferences — annotation stripping", () => {
  it("strips only the current item's annotation from the heading and body", () => {
    const content = [
      `## Heading ${ann("positive")}`,
      `A note ${ann("negative")} about the same item.`,
      `A cross-reference ${ann("neutral", "Other Risk")} to another item.`,
    ].join("\n");
    const entry = parse(content)[0];
    if (entry.scope !== "section") throw new Error("expected section");
    expect(entry.headingText).toBe("## Heading");
    // Current item's annotation removed from the body...
    expect(entry.bodyMarkdown).not.toContain("[[My Risk]]");
    // ...but the other item's annotation survives to render as a badge.
    expect(entry.bodyMarkdown).toContain(ann("neutral", "Other Risk"));
  });

  it("handles raid-item names containing regex metacharacters", () => {
    const name = "Risk (v2.0)";
    const entries = parse(`text ${ann("positive", name)}`, "Risk", name);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ scope: "line", lineText: "text" });
  });
});

// ─── Boundary cases ──────────────────────────────────────────────────────────

describe("parseRaidReferences — boundary cases", () => {
  it("matches the raid-item name case-sensitively (a differently-cased name does not match)", () => {
    // ITEM is "My Risk"; a lower-cased annotation must NOT be picked up.
    expect(parse(`text ${ann("positive", "my risk")}`)).toEqual([]);
  });

  it("treats a no-space `##Heading` as line scope (not a valid ATX heading)", () => {
    const content = [`##Heading ${ann("positive")}`, "body"].join("\n");
    const entries = parse(content);
    expect(entries).toHaveLength(1);
    expect(entries[0].scope).toBe("line");
  });

  it("gives each identically-titled tagged heading its own correct section", () => {
    const content = [
      `## Duplicate ${ann("positive")}`,
      "first body",
      `## Duplicate ${ann("negative")}`,
      "second body",
    ].join("\n");
    const entries = parse(content);
    expect(entries).toHaveLength(2);

    const [first, second] = entries;
    if (first.scope !== "section" || second.scope !== "section") {
      throw new Error("expected two section entries");
    }
    expect(first.headingText).toBe("## Duplicate");
    expect(first.bodyMarkdown).toBe("first body");
    expect(second.headingText).toBe("## Duplicate");
    expect(second.bodyMarkdown).toBe("second body");
  });
});

// ─── isSectionHeadingLine helper ─────────────────────────────────────────────

describe("isSectionHeadingLine", () => {
  it("returns true for a real ATX heading line", () => {
    const content = ["intro", "## A real heading", "body"].join("\n");
    expect(isSectionHeadingLine(content, 1)).toBe(true);
  });

  it("returns false for a #-line inside a fenced code block", () => {
    const content = ["```bash", "# not a heading", "```"].join("\n");
    expect(isSectionHeadingLine(content, 1)).toBe(false);
  });

  it("returns false for a non-heading line", () => {
    const content = ["just prose", "more prose"].join("\n");
    expect(isSectionHeadingLine(content, 0)).toBe(false);
  });
});
