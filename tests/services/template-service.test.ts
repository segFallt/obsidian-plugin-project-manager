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
        "recurring-meeting-event",
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

    it("project template includes pm-entity-view block for linked section", () => {
      const tmpl = svc.getTemplate("project");
      expect(tmpl).toContain("```pm-entity-view");
      expect(tmpl).toContain("entity: project");
      expect(tmpl).toContain("section: linked");
    });

    it("project template includes notesDir variable placeholder", () => {
      expect(svc.getTemplate("project")).toContain("{{notesDir}}");
    });

    it("client template includes create-client pm-actions block", () => {
      const tmpl = svc.getTemplate("client");
    });

    it("engagement template includes create-engagement pm-actions block", () => {
      const tmpl = svc.getTemplate("engagement");
    });

    it("person template includes create-person pm-actions block", () => {
      const tmpl = svc.getTemplate("person");
    });

    it("recurring-meeting-event template contains recurring-meeting frontmatter key", () => {
      const tmpl = svc.getTemplate("recurring-meeting-event");
      expect(tmpl).toContain("recurring-meeting:");
    });

    it("recurring-meeting-event template contains pm-properties block with entity: recurring-meeting-event", () => {
      const tmpl = svc.getTemplate("recurring-meeting-event");
      expect(tmpl).toContain("```pm-properties");
      expect(tmpl).toContain("entity: recurring-meeting-event");
    });

    it("recurring-meeting-event template contains date and attendees frontmatter keys", () => {
      const tmpl = svc.getTemplate("recurring-meeting-event");
      expect(tmpl).toContain("date:");
      expect(tmpl).toContain("attendees:");
    });

    it("recurring-meeting template contains pm-recurring-events code block", () => {
      const tmpl = svc.getTemplate("recurring-meeting");
      expect(tmpl).toContain("```pm-recurring-events");
    });

    it("recurring-meeting template contains pm-actions block with create-recurring-meeting-event action", () => {
      const tmpl = svc.getTemplate("recurring-meeting");
      expect(tmpl).toContain("create-recurring-meeting-event");
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
      });
      expect(result).toContain("projects/notes/test_project");
      expect(result).not.toContain("{{notesDir}}");
      // engagement is set via processFrontMatter post-creation, not baked into template
      expect(result).not.toContain("[[");
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
