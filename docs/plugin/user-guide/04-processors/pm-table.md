# pm-table

Renders a relationship table listing the entities linked to the current note.

![pm-table showing a client's engagements and people](assets/pm-table-client.png)

---

## Configuration

````markdown
```pm-table
type: <table-type>
```
````

| Parameter | Required | Description |
|-----------|----------|-------------|
| `type` | Yes | Which relationship to display — see table below |

### Table types

| `type` value | Displays | Intended note type |
|---|---|---|
| `client-engagements` | All engagements where `client` matches the current file's name | Client notes |
| `client-people` | All people where `client` matches the current file's name | Client notes |
| `engagement-projects` | All projects where `engagement` links to the current file | Engagement notes |
| `related-project-notes` | All notes with `relatedProject` linking to the current file, plus all backlinks | Project notes |
| `mentions` | All vault files that link to the current file (backlinks) | Person notes |

---

## Examples

### Client note — engagements table

````markdown
```pm-table
type: client-engagements
```
````

![Engagement projects table](assets/pm-table-engagement-projects.png)

### Project note — linked project notes table

````markdown
```pm-table
type: related-project-notes
```
````

![Project notes table](assets/pm-table-project-notes.png)

---

## Behaviour

- Tables refresh automatically when vault files change (500 ms debounce after the last modification)
- Requires the **Dataview plugin** to be installed and enabled — the table renders a "Dataview not available" message if Dataview is missing
- Empty tables render a "No items found" placeholder rather than hiding the block
- Clicking a row item navigates to the linked note
