import type { IActionContextManager } from "./interfaces";

/**
 * Manages transient action context set by action buttons so that
 * create commands can pre-populate parent entity fields.
 *
 * Replaces the mutable `pendingActionContext` field on PluginServices,
 * encapsulating the get/set/consume lifecycle in a single object.
 */
export class ActionContextManager implements IActionContextManager {
  private context: { field: string; value: string } | null = null;

  get(): { field: string; value: string } | null {
    return this.context;
  }

  set(context: { field: string; value: string }): void {
    this.context = context;
  }

  consume(): { field: string; value: string } | null {
    const ctx = this.context;
    this.context = null;
    return ctx;
  }
}
