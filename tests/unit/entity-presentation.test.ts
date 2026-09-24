import { describe, it, expect } from "vitest";
import { ENTITY_PRESENTATION } from "@/entity-registry";
import { ENTITY_LABEL, ENTITY_ICON, ENTITY_FAMILY_COLOR_TOKEN, ENTITY_TYPE } from "@/constants";
import type { EntityType } from "@/types";

const ALL_TYPES = Object.values(ENTITY_TYPE) as EntityType[];

describe("ENTITY_PRESENTATION registry", () => {
  it("carries a label, icon, and family-colour token per entity type", () => {
    for (const type of ALL_TYPES) {
      const presentation = ENTITY_PRESENTATION[type];
      expect(presentation.label).toBe(ENTITY_LABEL[type]);
      expect(presentation.icon).toBe(ENTITY_ICON[type]);
      expect(presentation.familyColorToken).toBe(ENTITY_FAMILY_COLOR_TOKEN[type]);
    }
  });

  it("references a token name, not a raw hex value, for the family colour", () => {
    for (const type of ALL_TYPES) {
      const token = ENTITY_PRESENTATION[type].familyColorToken;
      expect(token.startsWith("--pm-entity-")).toBe(true);
      expect(token).not.toContain("#");
    }
  });
});
