import { describe, it, expect, vi } from "vitest";
import { MarkdownRenderChild, TFile } from "obsidian";
import { TaskListRenderer } from "@/processors/task-list-renderer";
import { createMockTask } from "../mocks/dataview-mock";
import { DEFAULT_FOLDERS } from "@/constants";
import type { TaskProcessorServices } from "@/plugin-context";

// ─── Mock services factory ────────────────────────────────────────────────────

function createMockServices(): TaskProcessorServices {
  return {
    app: {
      vault: {
        getAbstractFileByPath: vi.fn(() => new TFile("projects/Alpha.md")),
        read: vi.fn(async () => "- [ ] Sample task"),
        modify: vi.fn(async () => {}),
        on: vi.fn(() => ({ id: "mock-event" })),
      },
      metadataCache: {
        getFileCache: vi.fn(() => null),
      },
      fileManager: {
        processFrontMatter: vi.fn(async () => {}),
      },
    },
    settings: {
      folders: DEFAULT_FOLDERS,
      ui: {
        defaultTaskViewMode: "context",
        showCompletedByDefault: false,
      },
    },
    queryService: {
      dv: vi.fn(() => null),
      getActiveEntitiesByTag: vi.fn(() => []),
    },
    taskParser: {
      toggleTaskLine: vi.fn((line: string) => line.replace("[ ]", "[x]")),
    },
    loggerService: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    },
    filterService: {
      applyDashboardFilters: vi.fn((tasks) => tasks),
    },
    sortService: {
      sortTasks: vi.fn((tasks) => tasks),
    },
  } as unknown as TaskProcessorServices;
}

// ─── Renderer factory ─────────────────────────────────────────────────────────

function createRenderer() {
  const services = createMockServices();
  const containerEl = document.createElement("div");
  const component = new MarkdownRenderChild(containerEl);
  const renderer = new TaskListRenderer(services, component);
  return { renderer, services };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("TaskListRenderer", () => {
  describe("renderTaskList", () => {
    it("renders source link with compact static label", async () => {
      const { renderer } = createRenderer();
      const container = document.createElement("div");
      const task = createMockTask({ path: "projects/Alpha.md", text: "Sample task" });

      await renderer.renderTaskList(container, [task]);
      await flushPromises();

      const sourceLink = container.querySelector(".pm-task-source");
      expect(sourceLink).not.toBeNull();
      expect(sourceLink!.textContent).toBe("link");
    });

    it("sets href attribute on source link to task.link.path", async () => {
      const { renderer } = createRenderer();
      const container = document.createElement("div");
      const task = createMockTask({ path: "projects/Alpha.md", text: "Sample task" });

      await renderer.renderTaskList(container, [task]);
      await flushPromises();

      const sourceLink = container.querySelector<HTMLAnchorElement>(".pm-task-source");
      expect(sourceLink).not.toBeNull();
      expect(sourceLink!.getAttribute("href")).toBe(task.link.path);
    });

    it("sets dataset.href on source link to task.link.path", async () => {
      const { renderer } = createRenderer();
      const container = document.createElement("div");
      const task = createMockTask({ path: "projects/Alpha.md", text: "Sample task" });

      await renderer.renderTaskList(container, [task]);
      await flushPromises();

      const sourceLink = container.querySelector<HTMLAnchorElement>(".pm-task-source");
      expect(sourceLink).not.toBeNull();
      expect(sourceLink!.dataset.href).toBe(task.link.path);
    });
  });

  describe("toggleTask", () => {
    it("calls app.vault.modify when toggling a task", async () => {
      const { renderer, services } = createRenderer();
      const task = createMockTask({ path: "projects/Alpha.md", text: "Sample task", line: 0 });

      await renderer.toggleTask(task, true);

      expect(services.app.vault.modify).toHaveBeenCalled();
    });

    it("does not call app.vault.modify when file is not found", async () => {
      const { renderer, services } = createRenderer();
      (services.app.vault.getAbstractFileByPath as ReturnType<typeof vi.fn>).mockReturnValue(null);
      const task = createMockTask({ path: "projects/Missing.md", text: "Sample task", line: 0 });

      await renderer.toggleTask(task, true);

      expect(services.app.vault.modify).not.toHaveBeenCalled();
    });
  });
});
