# Search Panel

The search panel is a fast, fuzzy finder for every project-management entity in your vault. Open it, start typing, and jump straight to any client, engagement, project, person, meeting, inbox note, project note, RAID item, reference, or reference topic — ranked by how well its name matches what you typed.

Unlike the `pm-*` code blocks, the search panel is not embedded in a note. It opens in its own tab from a command or the ribbon.

<!-- Screenshot placeholder: the search panel with results listed. No local asset
     exists yet; capture as docs/plugin/user-guide/assets/pm-search-hero.png and embed here. -->

---

## Opening the panel

- **Command palette:** `Ctrl/Cmd + P`, then run **PM: Open Search**.
- **Ribbon icon:** the search icon in the left ribbon (shown when **Settings → Show ribbon icons** is enabled).

If the panel is already open, either method reveals the existing tab rather than opening a second one.

---

## Searching

Type in the search box at the top of the panel. Matching is **fuzzy** and case-insensitive: you do not need the exact name, and the characters that matched your query are highlighted in each result. Results are ordered best-match first, with ties broken alphabetically.

- Leaving the box empty **browses** every entity in scope, with no highlighting.
- The clear button (×) appears once you have typed something; clicking it empties the box and returns to browse mode.
- The count row on the right shows how many results matched (for example, "12 results"), or "—" when Dataview is unavailable.

Each result row shows:

- A **type icon**, tinted with the entity type's colour.
- The **entity name**, with matched characters highlighted.
- A **breadcrumb** of the levels above it — Client › Engagement. A reference that is not linked to a client or engagement reads "Knowledge base" instead.
- A **type pill** on the right (Client, Project, Person, RAID Item, and so on).

Select any row to open that note.

---

## Narrowing your search

The **Narrow by client, engagement, person…** button opens a drawer where you can restrict what the search covers. The drawer holds two kinds of control: the client / engagement / person **scope** fields and the entity-**type** toggles. Every restriction you add also shows up as a removable chip in the bar under the button, so you can see the active filters at a glance and drop any of them.

When nothing is active, the bar reads **"Searching the whole vault. Add a filter to narrow."** A **Clear** button appears beside the Narrow-by button whenever a filter is active; it removes every scope and type filter in one click.

### By client, engagement, or person

Each scope field is a search-and-add box: start typing a client, engagement, or person name and pick it from the list to add it as a chip.

- Adding a value narrows results to entities under that part of the hierarchy. The **person** scope follows the relationships your vault records — the person's own note, RAID items they own, meetings they attend, and their reporting line.
- Adding several values to one field **widens** within that field (any of them match); values across different fields **combine** (a result must satisfy each field you have filled).
- When you open the panel from a note that belongs to a client or engagement, that client and engagement are **pre-added** as chips automatically, each marked with a small home icon so you can tell them from ones you added yourself. Remove them like any other chip if you want a broader search.

### By entity type

The drawer also lists the entity types as toggle chips, grouped by family:

| Family | Types |
|--------|-------|
| **Accounts** | Client, Engagement, Project |
| **People** | Person |
| **Meetings** | Single Meeting, Recurring Meeting, Recurring Meeting Event |
| **Capture** | Inbox Note |
| **Knowledge** | Reference, Reference Topic, Project Note |
| **Risk** | RAID Item |

- Enable one or more types to restrict results to those types. Selecting several types shows results from **any** of them.
- With **no** type enabled, results include **every** type.
- Each enabled type also appears as a removable chip in the bar. Removing the chip turns its toggle back off — the toggle and the chip always stay in step.

Your scope and type selections are **remembered** between sessions: the panel reopens with the same filters you left it with. (The text you typed in the search box and whether the drawer is open are not remembered.)

<!-- Screenshot placeholder: the filter drawer expanded with scope fields and type toggles.
     Capture as docs/plugin/user-guide/assets/pm-search-filter-drawer.png. -->

---

## Requirements

- The **Dataview plugin** must be installed and enabled. Without it the panel shows a "Search needs Dataview" message; enable Dataview so the vault can be indexed.
- Entities are found by their tag or their folder, so search covers the notes created by the **PM: Create …** commands and any notes that live in the configured entity folders.

---

## Tips

- Search matches the **note name** only, not its contents — name your entities the way you will look for them.
- Use the type filter to cut through a common word: enabling only **Project** keeps a search for "portal" from surfacing every meeting and note that mentions it.
- The panel is navigate-only — it never changes your notes. Use the entity commands and `pm-properties` to create or edit.
