import { describe, it, expect } from "vitest";
import { insertIntoNotesSection, extractNotesSection } from "@/utils/notes-section";

describe("notes-section", () => {
  describe("insertIntoNotesSection", () => {
    it("replaces the placeholder dash when the section has a `# Notes\\n-` marker", () => {
      const content = "---\ntags: []\n---\n# Notes\n-\n";
      expect(insertIntoNotesSection(content, "- [ ] task")).toBe("---\ntags: []\n---\n# Notes\n- [ ] task\n");
    });

    it("inserts the body after a bare `# Notes` heading", () => {
      const content = "# Notes\nexisting line\n";
      expect(insertIntoNotesSection(content, "- [ ] task")).toBe("# Notes\n- [ ] task\nexisting line\n");
    });

    it("prefers the dash marker over the bare heading when both would match", () => {
      const content = "# Notes\n-\n";
      // The `# Notes\n-` branch wins, so no extra trailing newline is added.
      expect(insertIntoNotesSection(content, "- [ ] task")).toBe("# Notes\n- [ ] task\n");
    });

    it("appends a fresh `# Notes` section when no heading exists (body is never dropped)", () => {
      const content = "---\ntags: []\n---\nSome body text.";
      const result = insertIntoNotesSection(content, "- [ ] task");
      expect(result).toBe("---\ntags: []\n---\nSome body text.\n# Notes\n- [ ] task");
      expect(result).toContain("- [ ] task");
    });
  });

  describe("extractNotesSection", () => {
    it("returns the trimmed content after the first `# Notes` heading", () => {
      const content = "---\ntags: []\n---\n# Notes\n- item one\n- item two\n";
      expect(extractNotesSection(content)).toBe("- item one\n- item two");
    });

    it("strips a leading placeholder-dash line", () => {
      const content = "intro\n# Notes\n-\n";
      expect(extractNotesSection(content)).toBe("");
    });

    it("keeps a dash that begins real list content", () => {
      const content = "intro\n# Notes\n- real item\n";
      expect(extractNotesSection(content)).toBe("- real item");
    });

    it("returns an empty string when there is no Notes section", () => {
      expect(extractNotesSection("just some text, no heading")).toBe("");
    });
  });
});
