import type { EntityType } from "../types";
import { todayISO, nowDatetime } from "../utils/date-utils";
import type { ITemplateService } from "./interfaces";
import {
  TEMPLATE_CLIENT,
  TEMPLATE_ENGAGEMENT,
  TEMPLATE_PROJECT,
  TEMPLATE_PERSON,
  TEMPLATE_INBOX,
  TEMPLATE_SINGLE_MEETING,
  TEMPLATE_RECURRING_MEETING,
  TEMPLATE_RECURRING_MEETING_EVENT,
  TEMPLATE_PROJECT_NOTE,
  RAID_ITEM_TEMPLATE,
  TEMPLATE_REFERENCE,
  TEMPLATE_REFERENCE_TOPIC,
} from "./template-constants";

/**
 * Provides embedded note templates for all entity types.
 *
 * Templates use `{{variable}}` syntax, processed by `processTemplate()`.
 * All Meta Bind / Templater syntax has been replaced with pm-* code blocks.
 *
 * Available variables: {{date}}, {{datetime}}, {{name}}, {{notesDir}},
 *                      {{engagement}}, {{relatedProject}}
 */
export class TemplateService implements ITemplateService {
  private static readonly TEMPLATES: Record<EntityType, string> = {
    client: TEMPLATE_CLIENT,
    engagement: TEMPLATE_ENGAGEMENT,
    project: TEMPLATE_PROJECT,
    person: TEMPLATE_PERSON,
    inbox: TEMPLATE_INBOX,
    "single-meeting": TEMPLATE_SINGLE_MEETING,
    "recurring-meeting": TEMPLATE_RECURRING_MEETING,
    "recurring-meeting-event": TEMPLATE_RECURRING_MEETING_EVENT,
    "project-note": TEMPLATE_PROJECT_NOTE,
    "raid-item": RAID_ITEM_TEMPLATE,
    "reference": TEMPLATE_REFERENCE,
    "reference-topic": TEMPLATE_REFERENCE_TOPIC,
  };

  /**
   * Returns the raw template string for the given entity type.
   */
  getTemplate(type: EntityType): string {
    return TemplateService.TEMPLATES[type];
  }

  /**
   * Substitutes `{{variable}}` placeholders in a template string.
   *
   * @param template - Raw template with `{{key}}` placeholders
   * @param vars     - Map of variable names to their values
   */
  processTemplate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
  }

  /**
   * Returns the default variable map with today's date.
   * Callers should merge additional entity-specific variables.
   */
  defaultVars(): Record<string, string> {
    return {
      date: todayISO(),
      datetime: nowDatetime(),
      name: "",
    };
  }
}
