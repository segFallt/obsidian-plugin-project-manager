import { describe, it, expect, vi, afterEach } from "vitest";
import { App } from "obsidian";
import { PropertySuggest } from "../../../src/ui/components/property-suggest";
import type { AutocompleteOption, AutocompleteConfig } from "../../../src/ui/components/property-suggest";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const OPTIONS: AutocompleteOption[] = [
  { value: "Acme", displayText: "Acme" },
  { value: "BetaCo", displayText: "BetaCo (Acme)" },
  { value: "Gamma", displayText: "Gamma Inc" },
];

function makeAc(
  options: AutocompleteOption[] = OPTIONS,
  currentValue: string | null = null,
  configOverrides: Partial<AutocompleteConfig> = {}
): {
  parent: HTMLElement;
  ac: PropertySuggest;
  onSelect: ReturnType<typeof vi.fn>;
  onClear: ReturnType<typeof vi.fn>;
} {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const onSelect = vi.fn();
  const onClear = vi.fn();
  const config: AutocompleteConfig = {
    placeholder: "Select...",
    ariaLabel: "Test field",
    onSelect,
    onClear,
    ...configOverrides,
  };
  const app = new App();
  const ac = new PropertySuggest(parent, app, options, currentValue, config);
  return { parent, ac, onSelect, onClear };
}

afterEach(() => {
  document.body.innerHTML = "";
});

// ─── Rendering ────────────────────────────────────────────────────────────────

describe("PropertySuggest — rendering", () => {
  it("creates a container div with class pm-autocomplete", () => {
    const { parent } = makeAc();
    expect(parent.querySelector(".pm-autocomplete")).not.toBeNull();
  });

  it("creates an input inside the container", () => {
    const { parent } = makeAc();
    const input = parent.querySelector(".pm-autocomplete__input");
    expect(input).not.toBeNull();
    expect(input?.tagName).toBe("INPUT");
  });

  it("sets placeholder on input", () => {
    const { parent } = makeAc();
    const input = parent.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    expect(input.placeholder).toBe("Select...");
  });

  it("sets role=combobox on input", () => {
    const { parent } = makeAc();
    const input = parent.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    expect(input.getAttribute("role")).toBe("combobox");
  });

  it("sets aria-expanded=false on input initially", () => {
    const { parent } = makeAc();
    const input = parent.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });

  it("sets aria-autocomplete=list on input", () => {
    const { parent } = makeAc();
    const input = parent.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    expect(input.getAttribute("aria-autocomplete")).toBe("list");
  });

  it("displays current value's displayText when currentValue is set", () => {
    const { parent } = makeAc(OPTIONS, "BetaCo");
    const input = parent.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    expect(input.value).toBe("BetaCo (Acme)");
  });

  it("leaves input empty when currentValue is null", () => {
    const { parent } = makeAc(OPTIONS, null);
    const input = parent.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    expect(input.value).toBe("");
  });

  it("exposes inputEl property", () => {
    const { ac, parent } = makeAc();
    const input = parent.querySelector(".pm-autocomplete__input");
    expect(ac.inputEl).toBe(input);
  });
});

// ─── Suggestion container ─────────────────────────────────────────────────────

describe("PropertySuggest — suggestion container", () => {
  it("opens suggestion container on input focus", () => {
    const { parent } = makeAc();
    const input = parent.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focus"));
    const container = parent.querySelector(".suggestion-container");
    expect(container).not.toBeNull();
  });
});

// ─── Filtering ────────────────────────────────────────────────────────────────

describe("PropertySuggest — filtering", () => {
  it("shows all options when opened with no text", () => {
    const { parent } = makeAc();
    const input = parent.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focus"));
    const optionEls = parent.querySelectorAll(".pm-autocomplete__option");
    // All 3 options + (None)
    expect(optionEls.length).toBe(4);
  });

  it("filters options by case-insensitive substring on displayText", () => {
    const { parent } = makeAc();
    const input = parent.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focus"));
    input.value = "acme";
    input.dispatchEvent(new Event("input"));
    const optionEls = parent.querySelectorAll(".pm-autocomplete__option:not(.pm-autocomplete__option--none)");
    // "Acme" and "BetaCo (Acme)" both match
    expect(optionEls.length).toBe(2);
  });

  it("(None) option is always visible when includeNone is true", () => {
    const { parent } = makeAc(OPTIONS, null, { includeNone: true });
    const input = parent.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focus"));
    input.value = "zzzzz";
    input.dispatchEvent(new Event("input"));
    const noneOption = parent.querySelector(".pm-autocomplete__option--none");
    expect(noneOption).not.toBeNull();
  });

  it("(None) option is excluded when includeNone is false", () => {
    const { parent } = makeAc(OPTIONS, null, { includeNone: false });
    const input = parent.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focus"));
    const noneOption = parent.querySelector(".pm-autocomplete__option--none");
    expect(noneOption).toBeNull();
  });

  it("(None) option included by default (includeNone defaults to true)", () => {
    const { parent } = makeAc();
    const input = parent.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focus"));
    const noneOption = parent.querySelector(".pm-autocomplete__option--none");
    expect(noneOption).not.toBeNull();
  });
});

// ─── Selection ────────────────────────────────────────────────────────────────

describe("PropertySuggest — selection", () => {
  it("onSelect fires with correct option on click", () => {
    const { parent, onSelect } = makeAc(OPTIONS, null, { includeNone: false });
    const input = parent.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focus"));
    const firstOption = parent.querySelector(".pm-autocomplete__option") as HTMLElement;
    firstOption.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(onSelect).toHaveBeenCalledWith(OPTIONS[0]);
  });

  it("input shows displayText after selection", () => {
    const { parent } = makeAc(OPTIONS, null, { includeNone: false });
    const input = parent.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focus"));
    const firstOption = parent.querySelector(".pm-autocomplete__option") as HTMLElement;
    firstOption.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(input.value).toBe("Acme");
  });

  it("closes suggestion container after selection", () => {
    const { parent } = makeAc(OPTIONS, null, { includeNone: false });
    const input = parent.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focus"));
    const firstOption = parent.querySelector(".pm-autocomplete__option") as HTMLElement;
    firstOption.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    const container = parent.querySelector(".suggestion-container") as HTMLElement;
    expect(container.style.display).toBe("none");
  });

  it("onClear fires when (None) option is selected", () => {
    const { parent, onClear, onSelect } = makeAc();
    const input = parent.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focus"));
    const noneOption = parent.querySelector(".pm-autocomplete__option--none") as HTMLElement;
    noneOption.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(onClear).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("input is cleared when (None) is selected", () => {
    const { parent } = makeAc(OPTIONS, "Acme");
    const input = parent.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focus"));
    const noneOption = parent.querySelector(".pm-autocomplete__option--none") as HTMLElement;
    noneOption.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(input.value).toBe("");
  });
});

// ─── clear() ──────────────────────────────────────────────────────────────────

describe("PropertySuggest — clear()", () => {
  it("resets input to empty string", () => {
    const { ac, parent } = makeAc(OPTIONS, "Acme");
    const input = parent.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    expect(input.value).toBe("Acme");
    ac.clear();
    expect(input.value).toBe("");
  });

  it("hides suggestion container if open", () => {
    const { ac, parent } = makeAc();
    const input = parent.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focus"));
    ac.clear();
    const container = parent.querySelector(".suggestion-container") as HTMLElement;
    expect(container.style.display).toBe("none");
  });
});

// ─── reopen() ─────────────────────────────────────────────────────────────────

describe("PropertySuggest — reopen()", () => {
  it("opens suggestion container after clear()", () => {
    const { ac, parent } = makeAc();
    const input = parent.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focus"));
    ac.clear();
    ac.reopen();
    // reopen() → suggest.open() → showSuggestions() removes old container and creates a new visible one
    const container = parent.querySelector(".suggestion-container") as HTMLElement;
    expect(container).not.toBeNull();
    expect(container.style.display).not.toBe("none");
  });

  it("shows all options with empty input after reopen()", () => {
    const { ac, parent } = makeAc(OPTIONS, null, { includeNone: false });
    const input = parent.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focus"));
    ac.clear();
    ac.reopen();
    const optionEls = parent.querySelectorAll(".pm-autocomplete__option");
    expect(optionEls.length).toBe(OPTIONS.length);
  });
});

// ─── destroy() ────────────────────────────────────────────────────────────────

describe("PropertySuggest — destroy()", () => {
  it("closes the suggest popover without error", () => {
    const { ac } = makeAc();
    expect(() => ac.destroy()).not.toThrow();
  });
});
