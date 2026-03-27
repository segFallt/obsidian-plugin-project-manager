# pm-raid-references

Renders a list of all notes in the vault that reference the current RAID item, grouped by source file. Place this block in a RAID item note.

References are created by annotating lines in any note using the format `{raid:positive|negative|neutral}[[RAID Item Name]]` — either manually, or via the **PM: Tag Line as RAID Reference** command.

![RAID references list](assets/pm-raid-references.png)

---

## Configuration

````markdown
```pm-raid-references
sort:
  field: created-date    # created-date (default) | modified-date
  direction: desc        # desc (default) | asc
```
````

All parameters are optional.

| Parameter | Default | Description |
|-----------|---------|-------------|
| `sort.field` | `created-date` | Sort source files by `created-date` or `modified-date` |
| `sort.direction` | `desc` | `desc` (newest first) or `asc` (oldest first) |

---

## How RAID Annotations Work

To link a line in any note to a RAID item:

1. Place your cursor on the line in editing view
2. Run **PM: Tag Line as RAID Reference** from the command palette
3. Select the RAID item and the direction (Positive / Negative / Neutral)

The annotation `{raid:positive}[[RAID Item Name]]` is appended to the line. In reading view, the `{raid:direction}` part renders as a styled badge with a human-readable label.

### Direction labels by RAID type

| Direction | Risk | Assumption | Issue | Decision |
|-----------|------|------------|-------|----------|
| Positive | ↑ Mitigates | ✓ Validates | ✓ Resolves | ✓ Supports |
| Negative | ↓ Escalates | ✗ Invalidates | ✗ Compounds | ✗ Challenges |
| Neutral | → Notes | → Notes | → Notes | → Notes |

---

## What the Block Renders

For each source file that contains at least one annotation for the current RAID item:

- A heading with a link to the source file
- Each annotated line as a list item, showing the direction badge, the text of the line, and a link back to the file

When no annotations are found, a placeholder message is displayed.

---

## Requirements

- The **Dataview plugin** must be installed and enabled
- RAID items must have the `#raid` tag in their frontmatter (added automatically by **PM: Create RAID Item**)

---

## Behaviour

- Auto-refreshes (500 ms debounce) when any vault file is modified
- RAID item name is inferred from the current note's filename
