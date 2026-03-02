import { describe, it, expect } from "vitest";
import { toSnakeCase, generateProjectNotesPath, fileNameFromPath } from "../../src/utils/path-utils";

describe("path-utils", () => {
  describe("toSnakeCase", () => {
    it("lowercases and replaces spaces with underscores", () => {
      expect(toSnakeCase("My Project")).toBe("my_project");
    });

    it("strips non-alphanumeric characters", () => {
      expect(toSnakeCase("My Project #1!")).toBe("my_project_1");
    });

    it("collapses multiple spaces", () => {
      expect(toSnakeCase("Foo   Bar")).toBe("foo_bar");
    });

    it("strips underscores (non-alphanumeric) from input", () => {
      // Matches vault script behaviour: [^a-z0-9\s] is stripped
      expect(toSnakeCase("my_project")).toBe("myproject");
    });

    it("strips leading/trailing underscores", () => {
      expect(toSnakeCase(" Project ")).toBe("project");
    });
  });

  describe("generateProjectNotesPath", () => {
    it("generates the correct notes path", () => {
      expect(generateProjectNotesPath("My Project")).toBe("projects/notes/my_project");
    });

    it("uses a custom base folder", () => {
      expect(generateProjectNotesPath("Foo Bar", "custom/notes")).toBe("custom/notes/foo_bar");
    });
  });

  describe("fileNameFromPath", () => {
    it("returns the file name without extension", () => {
      expect(fileNameFromPath("projects/My Project.md")).toBe("My Project");
    });

    it("handles paths without extension", () => {
      expect(fileNameFromPath("projects/foo")).toBe("foo");
    });

    it("handles just a file name", () => {
      expect(fileNameFromPath("test.md")).toBe("test");
    });
  });
});
