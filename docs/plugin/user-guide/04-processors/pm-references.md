# pm-references

Renders a filterable, searchable reference library. Place this block in any note to display all reference documents in the vault, grouped and filtered by topic, client, or engagement.

![References dashboard](assets/pm-references.png)

---

## Configuration

````markdown
```pm-references
mode: dashboard
# Optional defaults:
viewMode: topic | client | engagement
filter:
  topics:
    - "[[Topic Name]]"    # wikilinks to pre-select topic filter chips
  client: "Client Name"
  engagement: "Engagement Name"
```
````

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `mode` | No | `dashboard` | Display mode — only `dashboard` is currently supported |
| `viewMode` | No | `topic` | Initial grouping: `topic`, `client`, or `engagement` |
| `filter.topics` | No | None | Topic wikilinks to pre-select as active filters on load |
| `filter.client` | No | None | Client name to pre-select as an active filter on load |
| `filter.engagement` | No | None | Engagement name to pre-select as an active filter on load |

---

## View Modes

| Mode | Groups references by |
|------|----------------------|
| **By Topic** (`topic`) | Each linked Reference Topic. References with no topics appear under "Uncategorised". |
| **By Client** (`client`) | Client — resolved via the reference's `client` field, or via `engagement → client`. References with no resolvable client appear under "No Client". |
| **By Engagement** (`engagement`) | Linked engagement |

---

## Filtering and Search

- **View mode tabs** — switch between Topic / Client / Engagement groupings
- **Filters panel** (toggle via the Filters button) — chip selectors for Topics, Clients, and Engagements. Multiple chips can be active simultaneously; OR logic within each dimension, AND logic across dimensions.
- **Search input** — filters reference titles by text (300 ms debounce)
- **Clear filters** — resets all active chips and search text

---

## Filter State Persistence

Filter state (active chips, search text, view mode) is persisted to the note's frontmatter under the `pm-references-filters` key and restored on next load. Defaults set in the code block YAML apply only when no saved state exists.

---

## Requirements

- The **Dataview plugin** must be installed and enabled
- Reference documents must have the `#reference` tag (added automatically by **PM: Create Reference**)
- Reference Topics must have the `#reference-topic` tag (added automatically by **PM: Create Reference Topic**)

---

## Example

````markdown
```pm-references
mode: dashboard
viewMode: topic
filter:
  topics:
    - "[[Security]]"
```
````

This pre-selects the "Security" topic filter so only security-related references are shown on first load.
