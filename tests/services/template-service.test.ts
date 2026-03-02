import { describe, it, expect } from "vitest";
import { TemplateService } from "../../src/services/template-service";

describe("TemplateService", () => {
  const svc = new TemplateService();

  describe("getTemplate", () => {
    it("returns templates for all entity types", () => {
      const types = [
        "client",
        "engagement",
        "project",
        "person",
        "inbox",
        "single-meeting",
        "recurring-meeting",
        "project-note",
      ] as const;

      for (const type of types) {
        const tmpl = svc.getTemplate(type);
        expect(tmpl).toBeTruthy();
        expect(typeof tmpl).toBe("string");
      }
    });

    it("client template includes pm-properties block", () => {
      expect(svc.getTemplate("client")).toContain("```pm-properties");
      expect(svc.getTemplate("client")).toContain("entity: client");
    });

    it("project template includes pm-table and pm-actions blocks", () => {
      const tmpl = svc.getTemplate("project");
      expect(tmpl).toContain("```pm-table");
      expect(tmpl).toContain("```pm-actions");
    });

    it("project template includes notesDir variable placeholder", () => {
      expect(svc.getTemplate("project")).toContain("{{notesDir}}");
    });
  });

  describe("processTemplate", () => {
    it("substitutes all variables", () => {
      const template = "Hello {{name}}, created on {{date}}!";
      const result = svc.processTemplate(template, { name: "Alice", date: "2026-03-02" });
      expect(result).toBe("Hello Alice, created on 2026-03-02!");
    });

    it("replaces unknown variables with empty string", () => {
      const template = "{{unknown}} is unknown";
      const result = svc.processTemplate(template, {});
      expect(result).toBe(" is unknown");
    });

    it("does not modify template without variables", () => {
      const template = "No variables here";
      expect(svc.processTemplate(template, {})).toBe("No variables here");
    });

    it("processes project template with all required vars", () => {
      const tmpl = svc.getTemplate("project");
      const result = svc.processTemplate(tmpl, {
        date: "2026-03-02",
        datetime: "2026-03-02T10:00:00",
        name: "Test Project",
        notesDir: "projects/notes/test_project",
        engagement: "[[My Engagement]]",
      });
      expect(result).toContain("projects/notes/test_project");
      expect(result).not.toContain("{{notesDir}}");
      expect(result).not.toContain("{{engagement}}");
    });
  });

  describe("defaultVars", () => {
    it("returns an object with date and datetime", () => {
      const vars = svc.defaultVars();
      expect(vars).toHaveProperty("date");
      expect(vars.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(vars).toHaveProperty("datetime");
    });
  });
});
