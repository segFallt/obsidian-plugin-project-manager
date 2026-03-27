# pm-actions

Renders one or more action buttons. Each button triggers a plugin command when clicked — letting you create related records directly from the current note without opening the command palette.

![pm-actions showing four buttons](assets/pm-actions.png)

---

## Configuration

````markdown
```pm-actions
actions:
  - type: <action-type>
    label: <button text>
    style: primary | default | destructive
```
````

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `type` | Yes | — | The action to perform — see action types below |
| `label` | No | Action type name | Custom label for the button |
| `style` | No | `default` | Visual style: `primary` (filled), `default` (outlined), `destructive` (red) |

### Action types

| `type` | Command triggered |
|--------|-------------------|
| `create-client` | PM: Create Client |
| `create-engagement` | PM: Create Engagement |
| `create-project` | PM: Create Project |
| `create-person` | PM: Create Person |
| `create-inbox` | PM: Create Inbox Note |
| `create-single-meeting` | PM: Create Single Meeting |
| `create-recurring-meeting` | PM: Create Recurring Meeting |
| `create-recurring-meeting-event` | PM: Create Recurring Meeting Event |
| `create-project-note` | PM: Create Project Note |
| `convert-inbox` | PM: Convert Inbox to Project |
| `convert-single-to-recurring` | PM: Convert Single Meeting to Recurring |
| `create-raid-item` | PM: Create RAID Item |
| `scaffold-vault` | PM: Set Up Vault Structure |

You can also trigger any Obsidian command by its full ID using `commandId`:

```yaml
- commandId: obsidian-community-plugin:some-command
  label: Custom action
```

---

## Examples

### Client note action bar

````markdown
```pm-actions
actions:
  - type: create-engagement
    label: New Engagement
    style: primary
  - type: create-person
    label: New Person
    style: default
```
````

### Hub note with multiple entity types

````markdown
```pm-actions
actions:
  - type: create-client
    label: New Client
    style: primary
  - type: create-engagement
    label: New Engagement
    style: default
  - type: create-project
    label: New Project
    style: default
  - type: create-person
    label: New Person
    style: default
```
````

---

## Context pre-filling

When you click an action button, the plugin opens the creation modal. If the current note is the right entity type to pre-fill the modal's parent field, the parent field is automatically populated.

For example, clicking **New Engagement** from a Client note pre-fills the "client" field in the engagement creation modal with the current client's name. This means you rarely need to re-select context you can already infer from where you are.

The `context` key can also be set explicitly in the YAML if you want to force a specific field pre-fill:

```yaml
- type: create-project-note
  label: New Project Note
  style: primary
  context:
    field: relatedProject
```
