import { describe, it, expect, vi } from "vitest";
import { NavigationService } from "../../src/services/navigation-service";
import { TFile } from "../mocks/obsidian-mock";

function createMockApp(openFileSpy = vi.fn().mockResolvedValue(undefined)) {
  return {
    workspace: {
      getLeaf: vi.fn().mockReturnValue({ openFile: openFileSpy }),
    },
  } as unknown as import("obsidian").App;
}

describe("NavigationService", () => {
  describe("openFile()", () => {
    it("opens the given file in a new tab", async () => {
      const openFileSpy = vi.fn().mockResolvedValue(undefined);
      const getLeafSpy = vi.fn().mockReturnValue({ openFile: openFileSpy });
      const app = { workspace: { getLeaf: getLeafSpy } } as unknown as import("obsidian").App;
      const svc = new NavigationService(app);
      const file = new TFile("clients/Acme.md") as unknown as import("obsidian").TFile;

      await svc.openFile(file);

      expect(getLeafSpy).toHaveBeenCalledWith("tab");
      expect(openFileSpy).toHaveBeenCalledWith(file);
    });

    it("propagates errors thrown by leaf.openFile", async () => {
      const openFileSpy = vi.fn().mockRejectedValue(new Error("leaf error"));
      const app = createMockApp(openFileSpy);
      const svc = new NavigationService(app);
      const file = new TFile("clients/Acme.md") as unknown as import("obsidian").TFile;

      await expect(svc.openFile(file)).rejects.toThrow("leaf error");
    });
  });
});
