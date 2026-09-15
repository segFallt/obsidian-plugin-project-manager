import { describe, it, expect, vi } from "vitest";
import { TFile, TFolder } from "obsidian";
import {
  renderCollapsibleGroup,
  renderReferenceCard,
  renderEmptyState,
} from "@/processors/reference-views/reference-card-renderer";
import type { CardNavigationServices } from "@/processors/reference-views/reference-card-renderer";
import { makeRef } from "./render-helpers";

function cardServices(file: TFile | TFolder | null): {
  services: CardNavigationServices;
  openFile: ReturnType<typeof vi.fn>;
} {
  const openFile = vi.fn().mockResolvedValue(undefined);
  const services = {
    app: { vault: { getAbstractFileByPath: vi.fn(() => file) } } as unknown as CardNavigationServices["app"],
    navigationService: { openFile },
  };
  return { services, openFile };
}

describe("renderCollapsibleGroup", () => {
  it("renders an open details group with a title and count", () => {
    const container = document.createElement("div");
    const body = renderCollapsibleGroup(container, "Architecture", 3);
    const details = container.querySelector(".pm-ref-group")!;
    expect(details.tagName.toLowerCase()).toBe("details");
    expect(details.hasAttribute("open")).toBe(true);
    expect(container.querySelector(".pm-ref-group__title")?.textContent).toBe("Architecture");
    expect(container.querySelector(".pm-ref-group__count")?.textContent).toBe("3");
    expect(body.classList.contains("pm-ref-group__body")).toBe(true);
  });
});

describe("renderReferenceCard", () => {
  it("renders the icon, title link, and context chips", () => {
    const container = document.createElement("div");
    const { services } = cardServices(null);
    const ref = makeRef("My Note", { topics: ["Architecture"], client: "AcmeCo", engagement: "Retainer" });
    renderReferenceCard(container, ref, services);

    expect(container.querySelector(".pm-ref-card__icon")?.textContent).toBe("📄");
    expect(container.querySelector(".internal-link")?.textContent).toBe("My Note");
    expect(container.querySelector(".pm-ref-chip--topic")?.textContent).toBe("Architecture");
    expect(container.querySelector(".pm-ref-chip--client")?.textContent).toBe("AcmeCo");
    expect(container.querySelector(".pm-ref-chip--engagement")?.textContent).toBe("Retainer");
  });

  it("renders an optional hint when provided", () => {
    const container = document.createElement("div");
    const { services } = cardServices(null);
    renderReferenceCard(container, makeRef("Note", { topics: ["A"] }), services, "also in B");
    expect(container.querySelector(".pm-ref-card__hint")?.textContent).toBe("also in B");
  });

  it("opens the file on title click when the path resolves to a TFile", () => {
    const container = document.createElement("div");
    const file = new TFile("reference/references/My Note.md");
    const { services, openFile } = cardServices(file);
    renderReferenceCard(container, makeRef("My Note", { topics: ["A"] }), services);
    (container.querySelector(".internal-link") as HTMLAnchorElement).click();
    expect(openFile).toHaveBeenCalledWith(file);
  });

  it("does not open when the path resolves to a TFolder", () => {
    const container = document.createElement("div");
    const { services, openFile } = cardServices(new TFolder("some/path"));
    renderReferenceCard(container, makeRef("My Note", { topics: ["A"] }), services);
    (container.querySelector(".internal-link") as HTMLAnchorElement).click();
    expect(openFile).not.toHaveBeenCalled();
  });
});

describe("renderEmptyState", () => {
  it("renders a muted paragraph with the message", () => {
    const container = document.createElement("div");
    renderEmptyState(container, "No references found.");
    const el = container.querySelector(".pm-ref-empty")!;
    expect(el.tagName.toLowerCase()).toBe("p");
    expect(el.textContent).toBe("No references found.");
  });
});
