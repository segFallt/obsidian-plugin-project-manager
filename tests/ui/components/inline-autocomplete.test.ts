import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { InlineAutocomplete } from "../../../src/ui/components/inline-autocomplete";
import type { AutocompleteOption, AutocompleteConfig } from "../../../src/ui/components/inline-autocomplete";

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
): { parent: HTMLElement; ac: InlineAutocomplete; onSelect: ReturnType<typeof vi.fn>; onClear: ReturnType<typeof vi.fn> } {
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
  const ac = new InlineAutocomplete(parent, options, currentValue, config);
  return { parent, ac, onSelect, onClear };
}

afterEach(() => {
  document.body.innerHTML = "";
});

// ─── Rendering ────────────────────────────────────────────────────────────────

describe("InlineAutocomplete — rendering", () => {
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

  it("creates a dropdown div with role=listbox", () => {
    const { parent } = makeAc();
    const dropdown = parent.querySelector(".pm-autocomplete__dropdown");
    expect(dropdown).not.toBeNull();
    expect(dropdown?.getAttribute("role")).toBe("listbox");
  });

  it("exposes inputEl property", () => {
    const { ac, parent } = makeAc();
    const input = parent.querySelector(".pm-autocomplete__input");
    expect(ac.inputEl).toBe(input);
  });
});

// ─── Dropdown open/close ─────────────────────────────────────────────────────

describe("InlineAutocomplete — dropdown open/close", () => {
  it("opens dropdown on input focus", () => {
    const { parent } = makeAc();
    const input = parent.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focus"));
    const dropdown = parent.querySelector(".pm-autocomplete__dropdown") as HTMLElement;
    expect(dropdown.style.display).not.toBe("none");
    expect(input.getAttribute("aria-expanded")).toBe("true");
  });

  it("closes dropdown on Escape key", () => {
    const { parent } = makeAc();
    const input = parent.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focus"));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    const dropdown = parent.querySelector(".pm-autocomplete__dropdown") as HTMLElement;
    expect(dropdown.style.display).toBe("none");
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes dropdown on click outside", () => {
    const { parent } = makeAc();
    const input = parent.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focus"));
    // Click outside
    document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    const dropdown = parent.querySelector(".pm-autocomplete__dropdown") as HTMLElement;
    expect(dropdown.style.display).toBe("none");
  });
});

// ─── Filtering ────────────────────────────────────────────────────────────────

describe("InlineAutocomplete — filtering", () => {
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

  it("shows 'No matches' text when no options match", () => {
    const { parent } = makeAc();
    const input = parent.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focus"));
    input.value = "zzzzz";
    input.dispatchEvent(new Event("input"));
    const noMatch = parent.querySelector(".pm-autocomplete__no-results");
    expect(noMatch).not.toBeNull();
    expect(noMatch?.textContent).toContain("No matches");
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

// ─── Keyboard navigation ──────────────────────────────────────────────────────

describe("InlineAutocomplete — keyboard navigation", () => {
  it("ArrowDown moves highlight to first option", () => {
    const { parent } = makeAc();
    const input = parent.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focus"));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    const active = parent.querySelector(".pm-autocomplete__option--active");
    expect(active).not.toBeNull();
  });

  it("ArrowDown/ArrowUp wrap around", () => {
    const { parent } = makeAc(OPTIONS, null, { includeNone: false });
    const input = parent.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focus"));
    // Press ArrowUp from start — should wrap to last
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    const allOptions = parent.querySelectorAll(".pm-autocomplete__option");
    const lastOption = allOptions[allOptions.length - 1];
    expect(lastOption?.classList.contains("pm-autocomplete__option--active")).toBe(true);
  });

  it("ArrowDown navigates down through options", () => {
    const { parent } = makeAc(OPTIONS, null, { includeNone: false });
    const input = parent.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focus"));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    const allOptions = parent.querySelectorAll(".pm-autocomplete__option");
    expect(allOptions[1]?.classList.contains("pm-autocomplete__option--active")).toBe(true);
  });

  it("Enter selects highlighted option", () => {
    const { parent, onSelect } = makeAc(OPTIONS, null, { includeNone: false });
    const input = parent.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focus"));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(onSelect).toHaveBeenCalledWith(OPTIONS[0]);
  });

  it("Escape reverts input to currentDisplayText", () => {
    const { parent } = makeAc(OPTIONS, "Acme");
    const input = parent.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focus"));
    input.value = "typing...";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(input.value).toBe("Acme");
  });

  it("Enter does nothing when no option is highlighted", () => {
    const { parent, onSelect } = makeAc();
    const input = parent.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focus"));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});

// ─── Selection ────────────────────────────────────────────────────────────────

describe("InlineAutocomplete — selection", () => {
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

  it("dropdown closes after selection", () => {
    const { parent } = makeAc(OPTIONS, null, { includeNone: false });
    const input = parent.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focus"));
    const firstOption = parent.querySelector(".pm-autocomplete__option") as HTMLElement;
    firstOption.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    const dropdown = parent.querySelector(".pm-autocomplete__dropdown") as HTMLElement;
    expect(dropdown.style.display).toBe("none");
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

describe("InlineAutocomplete — clear()", () => {
  it("resets input to empty string", () => {
    const { ac, parent } = makeAc(OPTIONS, "Acme");
    const input = parent.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    expect(input.value).toBe("Acme");
    ac.clear();
    expect(input.value).toBe("");
  });

  it("closes dropdown if open", () => {
    const { ac, parent } = makeAc();
    const input = parent.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focus"));
    ac.clear();
    const dropdown = parent.querySelector(".pm-autocomplete__dropdown") as HTMLElement;
    expect(dropdown.style.display).toBe("none");
  });
});

// ─── click to open ────────────────────────────────────────────────────────────

describe("InlineAutocomplete — click to open", () => {
  it("opens dropdown when clicking a focused input with dropdown closed", () => {
    const { parent } = makeAc();
    const input = parent.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    // Focus first (opens), then close via Escape
    input.dispatchEvent(new FocusEvent("focus"));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    const dropdown = parent.querySelector(".pm-autocomplete__dropdown") as HTMLElement;
    expect(dropdown.style.display).toBe("none");
    // Now click — should reopen
    input.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(dropdown.style.display).not.toBe("none");
  });

  it("does not re-render dropdown when clicking an already-open dropdown", () => {
    const { parent } = makeAc();
    const input = parent.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focus"));
    const dropdown = parent.querySelector(".pm-autocomplete__dropdown") as HTMLElement;
    expect(dropdown.style.display).not.toBe("none");
    // Click while open — dropdown stays open
    input.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(dropdown.style.display).not.toBe("none");
  });
});

// ─── reopen() ─────────────────────────────────────────────────────────────────

describe("InlineAutocomplete — reopen()", () => {
  it("opens dropdown after clear()", () => {
    const { ac, parent } = makeAc();
    const input = parent.querySelector(".pm-autocomplete__input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focus"));
    ac.clear();
    const dropdown = parent.querySelector(".pm-autocomplete__dropdown") as HTMLElement;
    expect(dropdown.style.display).toBe("none");
    ac.reopen();
    expect(dropdown.style.display).not.toBe("none");
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

describe("InlineAutocomplete — destroy()", () => {
  it("removes document-level mousedown listener", () => {
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const { ac } = makeAc();
    ac.destroy();
    expect(removeSpy).toHaveBeenCalledWith("mousedown", expect.any(Function));
    removeSpy.mockRestore();
  });
});

// ─── Multiple instances ────────────────────────────────────────────────────────

describe("InlineAutocomplete — multiple instances", () => {
  it("mousedown on second instance closes first instance's dropdown", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);

    const ac1 = new InlineAutocomplete(parent, OPTIONS, null, {
      onSelect: vi.fn(),
      includeNone: false,
    });
    const ac2 = new InlineAutocomplete(parent, OPTIONS, null, {
      onSelect: vi.fn(),
      includeNone: false,
    });

    const dropdowns = parent.querySelectorAll(".pm-autocomplete__dropdown");
    const dropdown1 = dropdowns[0] as HTMLElement;
    const dropdown2 = dropdowns[1] as HTMLElement;

    // Open first
    ac1.inputEl.dispatchEvent(new FocusEvent("focus"));
    expect(dropdown1.style.display).not.toBe("none");

    // Mousedown on second's input: bubbles to document.
    // ac1's handler: target not in ac1 container → closes ac1.
    // ac2's handler: target IS in ac2 container → does not close.
    ac2.inputEl.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(dropdown1.style.display).toBe("none");

    // Focus second → opens
    ac2.inputEl.dispatchEvent(new FocusEvent("focus"));
    expect(dropdown2.style.display).not.toBe("none");

    ac1.destroy();
    ac2.destroy();
  });

  it("two instances with distinct options show only their own options when opened", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);

    const opts1: AutocompleteOption[] = [{ value: "a", displayText: "Alpha" }];
    const opts2: AutocompleteOption[] = [{ value: "b", displayText: "Beta" }];

    const ac1 = new InlineAutocomplete(parent, opts1, null, {
      onSelect: vi.fn(),
      includeNone: false,
    });
    const ac2 = new InlineAutocomplete(parent, opts2, null, {
      onSelect: vi.fn(),
      includeNone: false,
    });

    const dropdowns = parent.querySelectorAll(".pm-autocomplete__dropdown");
    const dropdown2 = dropdowns[1] as HTMLElement;

    // Close first, open second
    ac2.inputEl.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    ac2.inputEl.dispatchEvent(new FocusEvent("focus"));

    expect(dropdown2.style.display).not.toBe("none");

    const visibleOptions = [...dropdown2.querySelectorAll(".pm-autocomplete__option")].map(
      (o) => o.textContent
    );
    expect(visibleOptions).toContain("Beta");
    expect(visibleOptions).not.toContain("Alpha");

    ac1.destroy();
    ac2.destroy();
  });
});
