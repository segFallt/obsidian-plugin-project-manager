import { describe, it, expect, vi, afterEach } from "vitest";
import { App } from "../../mocks/obsidian-mock";
import { FilterChipSelect } from "../../../src/ui/components/filter-chip-select";
import type { FilterChipSelectConfig } from "../../../src/ui/components/filter-chip-select";
import type { AutocompleteOption } from "../../../src/ui/components/property-suggest";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const OPTIONS: AutocompleteOption[] = [
  { value: "Acme", displayText: "Acme Corp" },
  { value: "BetaCo", displayText: "Beta Company" },
  { value: "Gamma", displayText: "Gamma Inc" },
];

function makeChipSelect(
  overrides: Partial<FilterChipSelectConfig> = {}
): {
  container: HTMLElement;
  chipSelect: FilterChipSelect;
  onChange: ReturnType<typeof vi.fn>;
} {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const onChange = vi.fn();
  const config: FilterChipSelectConfig = {
    options: OPTIONS,
    selectedValues: [],
    placeholder: "Add filter…",
    ariaLabel: "Filter",
    includeUnassigned: false,
    unassignedLabel: "Include unassigned",
    onChange,
    ...overrides,
  };
  const app = new App();
  const chipSelect = new FilterChipSelect(container, app as never, config);
  return { container, chipSelect, onChange };
}

afterEach(() => {
  document.body.innerHTML = "";
});

// ─── Rendering ────────────────────────────────────────────────────────────────

describe("FilterChipSelect — rendering", () => {
  it("creates .pm-filter-chip-select container", () => {
    const { container } = makeChipSelect();
    expect(container.querySelector(".pm-filter-chip-select")).not.toBeNull();
  });

  it("creates .pm-filter-chip-select__chips container", () => {
    const { container } = makeChipSelect();
    expect(container.querySelector(".pm-filter-chip-select__chips")).not.toBeNull();
  });

  it("renders chips for initial selected values", () => {
    const { container } = makeChipSelect({ selectedValues: ["Acme", "BetaCo"] });
    const chips = container.querySelectorAll(".pm-filter-chip-select__chip");
    expect(chips.length).toBe(2);
  });

  it("shows displayText in chip (not value when displayText differs)", () => {
    const { container } = makeChipSelect({ selectedValues: ["Acme"] });
    const chip = container.querySelector(".pm-filter-chip-select__chip");
    expect(chip?.textContent).toContain("Acme Corp");
  });

  it("renders remove button (×) on each chip", () => {
    const { container } = makeChipSelect({ selectedValues: ["Acme", "BetaCo"] });
    const removes = container.querySelectorAll(".pm-filter-chip-select__chip-remove");
    expect(removes.length).toBe(2);
    expect(removes[0].textContent).toBe("×");
  });

  it("renders a PropertySuggest input (.pm-autocomplete__input)", () => {
    const { container } = makeChipSelect();
    expect(container.querySelector(".pm-autocomplete__input")).not.toBeNull();
  });

  it("renders 'include unassigned' checkbox", () => {
    const { container } = makeChipSelect({ unassignedLabel: "Include unassigned" });
    const checkboxes = container.querySelectorAll("input[type='checkbox']");
    expect(checkboxes.length).toBe(1);
  });

  it("checkbox reflects initial includeUnassigned value", () => {
    const { container } = makeChipSelect({ includeUnassigned: true });
    const cb = container.querySelector("input[type='checkbox']") as HTMLInputElement;
    expect(cb.checked).toBe(true);
  });

  it("unassigned checkbox has aria-label set to unassignedLabel", () => {
    const { container } = makeChipSelect({ unassignedLabel: "Include projects without client" });
    const cb = container.querySelector("input[type='checkbox']") as HTMLInputElement;
    expect(cb.getAttribute("aria-label")).toBe("Include projects without client");
  });
});

// ─── Remove chip ─────────────────────────────────────────────────────────────

describe("FilterChipSelect — remove chip", () => {
  it("removes chip from display when remove button is clicked", () => {
    const { container } = makeChipSelect({ selectedValues: ["Acme", "BetaCo"] });
    const removeBtn = container.querySelector(".pm-filter-chip-select__chip-remove") as HTMLElement;
    removeBtn.click();
    const chips = container.querySelectorAll(".pm-filter-chip-select__chip");
    expect(chips.length).toBe(1);
  });

  it("calls onChange with updated array when chip is removed", () => {
    const { container, onChange } = makeChipSelect({ selectedValues: ["Acme", "BetaCo"] });
    const removeBtn = container.querySelector(".pm-filter-chip-select__chip-remove") as HTMLElement;
    removeBtn.click();
    expect(onChange).toHaveBeenCalledOnce();
    const [values] = onChange.mock.calls[0] as [string[], boolean];
    expect(values).not.toContain("Acme");
    expect(values).toContain("BetaCo");
  });

  it("calls onChange with current includeUnassigned value when chip removed", () => {
    const { container, onChange } = makeChipSelect({
      selectedValues: ["Acme"],
      includeUnassigned: true,
    });
    const removeBtn = container.querySelector(".pm-filter-chip-select__chip-remove") as HTMLElement;
    removeBtn.click();
    const [, includeUnassigned] = onChange.mock.calls[0] as [string[], boolean];
    expect(includeUnassigned).toBe(true);
  });
});

// ─── Add via suggest ─────────────────────────────────────────────────────────

describe("FilterChipSelect — add value via suggest", () => {
  it("adds a chip when a suggestion is selected", () => {
    const { container } = makeChipSelect();
    const input = container.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focus"));
    const option = container.querySelector(".pm-autocomplete__option") as HTMLElement;
    option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    const chips = container.querySelectorAll(".pm-filter-chip-select__chip");
    expect(chips.length).toBe(1);
  });

  it("calls onChange when a value is added via suggest", () => {
    const { container, onChange } = makeChipSelect();
    const input = container.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focus"));
    const option = container.querySelector(".pm-autocomplete__option") as HTMLElement;
    option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("does not add duplicate values", () => {
    const { container, onChange } = makeChipSelect({ selectedValues: ["Acme"] });
    const input = container.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focus"));
    // The first suggestion item is "Acme Corp" which maps to value "Acme"
    const firstOption = container.querySelector(".pm-autocomplete__option") as HTMLElement;
    firstOption.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    // onChange should NOT be called because Acme is already selected
    expect(onChange).not.toHaveBeenCalled();
    const chips = container.querySelectorAll(".pm-filter-chip-select__chip");
    expect(chips.length).toBe(1);
  });

  it("clears input after selection", () => {
    const { container } = makeChipSelect();
    const input = container.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focus"));
    const option = container.querySelector(".pm-autocomplete__option") as HTMLElement;
    option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(input.value).toBe("");
  });

  it("does not show (None) in suggest dropdown", () => {
    const { container } = makeChipSelect();
    const input = container.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focus"));
    const noneOption = container.querySelector(".pm-autocomplete__option--none");
    expect(noneOption).toBeNull();
  });
});

// ─── Include unassigned checkbox ─────────────────────────────────────────────

describe("FilterChipSelect — include unassigned checkbox", () => {
  it("calls onChange with includeUnassigned=true when checkbox is checked", () => {
    const { container, onChange } = makeChipSelect({ includeUnassigned: false });
    const cb = container.querySelector("input[type='checkbox']") as HTMLInputElement;
    cb.checked = true;
    cb.dispatchEvent(new Event("change"));
    expect(onChange).toHaveBeenCalledOnce();
    const [, includeUnassigned] = onChange.mock.calls[0] as [string[], boolean];
    expect(includeUnassigned).toBe(true);
  });

  it("calls onChange with includeUnassigned=false when checkbox is unchecked", () => {
    const { container, onChange } = makeChipSelect({ includeUnassigned: true });
    const cb = container.querySelector("input[type='checkbox']") as HTMLInputElement;
    cb.checked = false;
    cb.dispatchEvent(new Event("change"));
    const [, includeUnassigned] = onChange.mock.calls[0] as [string[], boolean];
    expect(includeUnassigned).toBe(false);
  });

  it("includes current selectedValues in onChange when checkbox changes", () => {
    const { container, onChange } = makeChipSelect({
      selectedValues: ["Acme"],
      includeUnassigned: false,
    });
    const cb = container.querySelector("input[type='checkbox']") as HTMLInputElement;
    cb.checked = true;
    cb.dispatchEvent(new Event("change"));
    const [values] = onChange.mock.calls[0] as [string[], boolean];
    expect(values).toContain("Acme");
  });
});

// ─── destroy() ───────────────────────────────────────────────────────────────

describe("FilterChipSelect — destroy()", () => {
  it("destroy() does not throw", () => {
    const { chipSelect } = makeChipSelect();
    expect(() => chipSelect.destroy()).not.toThrow();
  });
});
