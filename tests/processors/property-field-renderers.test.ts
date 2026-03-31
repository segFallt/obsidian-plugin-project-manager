import { describe, it, expect, vi } from "vitest";
import { renderField } from "@/processors/property-field-renderers";
import { TFile } from "../mocks/obsidian-mock";
import type { FieldRenderContext } from "@/processors/property-field-renderers";
import type { FieldDescriptor } from "@/processors/entity-field-config";
import type { PropertyProcessorServices } from "@/plugin-context";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTFile(path = "test/Note.md"): TFile {
  return new TFile(path) as unknown as import("obsidian").TFile;
}

function makeCtx(overrides: Partial<FieldRenderContext> = {}): FieldRenderContext {
  const services = {
    app: {
      vault: {},
      metadataCache: { getFileCache: vi.fn(() => null) },
    },
    queryService: {
      getActiveEntitiesByTag: vi.fn(() => []),
      getActiveRecurringMeetings: vi.fn(() => []),
    },
    loggerService: { error: vi.fn(), warn: vi.fn() },
    settings: {},
  } as unknown as PropertyProcessorServices;

  return {
    services,
    sourcePath: "test/Note.md",
    onAutocomplete: vi.fn(),
    updateFm: vi.fn(),
    ...overrides,
  };
}

function renderInDiv(field: FieldDescriptor, fm: Record<string, unknown>, ctx?: FieldRenderContext) {
  const el = document.createElement("div");
  renderField(el, field, fm, makeTFile(), ctx ?? makeCtx());
  return el;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("renderField — common behaviour", () => {
  it("creates a row div with pm-properties__row class", () => {
    const el = renderInDiv({ key: "title", label: "Title", type: "text" }, {});
    expect(el.querySelector(".pm-properties__row")).not.toBeNull();
  });

  it("renders a label with correct text", () => {
    const el = renderInDiv({ key: "title", label: "My Label", type: "text" }, {});
    expect(el.querySelector("label")?.textContent).toBe("My Label");
  });

  it("associates label with fieldId via 'for' attribute", () => {
    const el = renderInDiv({ key: "status", label: "Status", type: "text" }, {});
    const label = el.querySelector("label");
    const input = el.querySelector("input");
    expect(label?.getAttribute("for")).toBe(input?.id);
  });
});

describe("renderField — text type", () => {
  it("renders a text input with the current value", () => {
    const el = renderInDiv({ key: "title", label: "Title", type: "text" }, { title: "My Value" });
    const input = el.querySelector("input") as HTMLInputElement;
    expect(input.type).toBe("text");
    expect(input.value).toBe("My Value");
  });

  it("calls updateFm when input changes", () => {
    const ctx = makeCtx();
    const el = renderInDiv({ key: "title", label: "Title", type: "text" }, {}, ctx);
    const input = el.querySelector("input") as HTMLInputElement;
    input.value = "New Value";
    input.dispatchEvent(new Event("change"));
    expect(ctx.updateFm).toHaveBeenCalledWith(expect.anything(), "title", "New Value");
  });

  it("saves null when input is cleared", () => {
    const ctx = makeCtx();
    const el = renderInDiv({ key: "title", label: "Title", type: "text" }, { title: "Old" }, ctx);
    const input = el.querySelector("input") as HTMLInputElement;
    input.value = "";
    input.dispatchEvent(new Event("change"));
    expect(ctx.updateFm).toHaveBeenCalledWith(expect.anything(), "title", null);
  });
});

describe("renderField — textarea type", () => {
  it("renders a textarea with the current value", () => {
    const el = renderInDiv({ key: "notes", label: "Notes", type: "textarea" }, { notes: "Some notes" });
    const textarea = el.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea.value).toBe("Some notes");
  });

  it("calls updateFm when textarea changes", () => {
    const ctx = makeCtx();
    const el = renderInDiv({ key: "notes", label: "Notes", type: "textarea" }, {}, ctx);
    const textarea = el.querySelector("textarea") as HTMLTextAreaElement;
    textarea.value = "Updated";
    textarea.dispatchEvent(new Event("change"));
    expect(ctx.updateFm).toHaveBeenCalledWith(expect.anything(), "notes", "Updated");
  });
});

describe("renderField — date type", () => {
  it("renders a date input", () => {
    const el = renderInDiv({ key: "start-date", label: "Start Date", type: "date" }, {});
    const input = el.querySelector("input") as HTMLInputElement;
    expect(input.type).toBe("date");
  });

  it("renders a datetime-local input for datetime type", () => {
    const el = renderInDiv({ key: "date", label: "Date", type: "datetime" }, {});
    const input = el.querySelector("input") as HTMLInputElement;
    expect(input.type).toBe("datetime-local");
  });

  it("calls updateFm on change with the input value", () => {
    const ctx = makeCtx();
    const el = renderInDiv({ key: "start-date", label: "Start Date", type: "date" }, {}, ctx);
    const input = el.querySelector("input") as HTMLInputElement;
    input.value = "2025-01-15";
    input.dispatchEvent(new Event("change"));
    expect(ctx.updateFm).toHaveBeenCalledWith(expect.anything(), "start-date", "2025-01-15");
  });
});

describe("renderField — select type", () => {
  it("renders a select with the provided options", () => {
    const el = renderInDiv(
      { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"] },
      {}
    );
    const options = [...el.querySelectorAll("option")].map((o) => o.value);
    expect(options).toEqual(["Active", "Inactive"]);
  });

  it("pre-selects the current value", () => {
    const el = renderInDiv(
      { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"] },
      { status: "Inactive" }
    );
    const select = el.querySelector("select") as HTMLSelectElement;
    expect(select.value).toBe("Inactive");
  });

  it("calls updateFm when selection changes", () => {
    const ctx = makeCtx();
    const el = renderInDiv(
      { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"] },
      { status: "Active" },
      ctx
    );
    const select = el.querySelector("select") as HTMLSelectElement;
    select.value = "Inactive";
    select.dispatchEvent(new Event("change"));
    expect(ctx.updateFm).toHaveBeenCalledWith(expect.anything(), "status", "Inactive");
  });

  it("coerces value to number when valueType is 'number'", () => {
    const ctx = makeCtx();
    const el = renderInDiv(
      { key: "priority", label: "Priority", type: "select", options: ["1", "2", "3", "4", "5"], valueType: "number" },
      { priority: 1 },
      ctx
    );
    const select = el.querySelector("select") as HTMLSelectElement;
    select.value = "3";
    select.dispatchEvent(new Event("change"));
    expect(ctx.updateFm).toHaveBeenCalledWith(expect.anything(), "priority", 3);
  });

  it("preserves string value when valueType is absent", () => {
    const ctx = makeCtx();
    const el = renderInDiv(
      { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"] },
      { status: "Active" },
      ctx
    );
    const select = el.querySelector("select") as HTMLSelectElement;
    select.value = "Inactive";
    select.dispatchEvent(new Event("change"));
    expect(ctx.updateFm).toHaveBeenCalledWith(expect.anything(), "status", "Inactive");
  });

  it("calls updateFm with null when valueType is 'number' and select value is empty string", () => {
    const ctx = makeCtx();
    const el = renderInDiv(
      { key: "priority", label: "Priority", type: "select", options: ["1", "2", "3", "4", "5"], valueType: "number" },
      {},
      ctx
    );
    const select = el.querySelector("select") as HTMLSelectElement;
    select.value = "";
    select.dispatchEvent(new Event("change"));
    expect(ctx.updateFm).toHaveBeenCalledWith(expect.anything(), "priority", null);
  });

  it("calls updateFm with null when valueType is 'number' and select value is non-numeric string", () => {
    const ctx = makeCtx();
    const el = renderInDiv(
      { key: "priority", label: "Priority", type: "select", options: ["1", "2", "3", "4", "5"], valueType: "number" },
      {},
      ctx
    );
    const select = el.querySelector("select") as HTMLSelectElement;
    select.value = "abc";
    select.dispatchEvent(new Event("change"));
    expect(ctx.updateFm).toHaveBeenCalledWith(expect.anything(), "priority", null);
  });
});

describe("renderField — suggester type", () => {
  it("does not crash when entityTag is missing", () => {
    expect(() =>
      renderInDiv({ key: "client", label: "Client", type: "suggester" }, {})
    ).not.toThrow();
  });

  it("calls onAutocomplete when rendering a suggester field", () => {
    const ctx = makeCtx();
    renderInDiv(
      { key: "client", label: "Client", type: "suggester", entityTag: "#client" },
      {},
      ctx
    );
    expect(ctx.onAutocomplete).toHaveBeenCalled();
  });
});

describe("renderField — list-suggester type", () => {
  it("does not crash when entityTag is missing", () => {
    expect(() =>
      renderInDiv({ key: "attendees", label: "Attendees", type: "list-suggester" }, {})
    ).not.toThrow();
  });

  it("renders chip container", () => {
    const el = renderInDiv(
      { key: "attendees", label: "Attendees", type: "list-suggester", entityTag: "#person" },
      {}
    );
    expect(el.querySelector(".pm-properties__chips")).not.toBeNull();
  });

  it("calls onAutocomplete for the add-more suggester", () => {
    const ctx = makeCtx();
    renderInDiv(
      { key: "attendees", label: "Attendees", type: "list-suggester", entityTag: "#person" },
      {},
      ctx
    );
    expect(ctx.onAutocomplete).toHaveBeenCalled();
  });
});
