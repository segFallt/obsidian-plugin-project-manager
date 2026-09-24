# Entity Hierarchy Resolution

Dual-path client and engagement resolution owned entirely by
`EntityHierarchyService` (it reads Dataview and the folder settings directly; it
no longer delegates to `QueryService`).

```mermaid
flowchart TD
    A["resolveClientName(page)"] --> B

    B["normalizeToName(page.client)"] --> C{direct client\nname found?}

    C -->|"Yes"| D["return clientName"]

    C -->|"No"| E["getEngagementNameForPath(page.file.path)"]

    E --> F["getEngagementNameForPath(path)"]

    subgraph EngagementPaths["getEngagementNameForPath — three sub-paths"]
        F1["1. Direct engagement\nnormalizeToName(page.engagement)\nif truthy → return engName"]
        F2["2. Project note path\npage.relatedProject exists?\n→ load project page\n→ normalizeToName(project.engagement)"]
        F3["3. Recurring meeting event path\npage['recurring-meeting'] exists?\n→ load recurring meeting page\n→ normalizeToName(meeting.engagement)"]

        F1 --> FA{found?}
        FA -->|"Yes"| FB["return engName"]
        FA -->|"No"| F2

        F2 --> FC{found?}
        FC -->|"Yes"| FD["return engName"]
        FC -->|"No"| F3

        F3 --> FE{found?}
        FE -->|"Yes"| FF["return engName"]
        FE -->|"No"| FG["return null"]
    end

    F --> EngagementPaths

    FB --> G["engName found"]
    FD --> G
    FF --> G
    FG --> H["engName is null"]

    G --> I["getClientFromEngagementLink(engName)"]
    I --> J["normalizeToName(engagementLink) → engName\ndv.page(engagements/engName)\n→ normalizeToName(engPage.client)"]
    J --> K{client found?}
    K -->|"Yes"| L["return clientName"]
    K -->|"No"| P

    H --> P

    P{page.relatedProject\nset?}
    P -->|"Yes"| Q["load parent project page\n→ resolve its direct/engagement client (single-level)"]
    P -->|"No"| M["return null"]
    Q --> R{client found?}
    R -->|"Yes"| S["return clientName"]
    R -->|"No"| M

    N["resolveEngagementName(page)"] --> O["getEngagementNameForPath(page.file.path)"]
    O --> EngagementPaths
```

The parent-project fallback (path `P`) is what a project note whose parent
project carries a direct client — but no engagement — relies on: when the direct
and engagement chains yield nothing, `resolveClientName` resolves the parent
project's own direct/engagement client. This is single-level and bounded — it
does not follow another `relatedProject` hop on the parent — so a malformed
parent chain cannot recurse without end.

## Reuse by contextual search

The `pm-search` scope facets (`src/services/search-filter.ts`) do **not**
re-implement any of this traversal. The client and engagement scope predicates
call `resolveClientName` / `resolveEngagementName` on each candidate page and keep
it when the resolved name matches a selected scope name (OR within a facet), and
`SearchService` reuses the same two methods to build each result's Client ›
Engagement breadcrumb. The person scope facet is the one addition search brings:
`PersonAssociationResolver.peopleOf(page)` is a separate, focused resolver
(Person note self, RAID `owner`, meeting `attendees` / `default-attendees`, and
the `reports-to` chain), because person links are not part of the upward
client/engagement chain — there is no downward multi-hop traversal and no
team-members field.

```mermaid
flowchart LR
    Candidate["entity candidate page"] --> ClientFacet["client scope facet"]
    Candidate --> EngFacet["engagement scope facet"]
    Candidate --> PersonFacet["person scope facet"]
    ClientFacet --> RCN["EntityHierarchyService.resolveClientName(page)"]
    EngFacet --> REN["EntityHierarchyService.resolveEngagementName(page)"]
    PersonFacet --> PAR["PersonAssociationResolver.peopleOf(page)"]
    RCN --> Keep{"matches a<br/>selected name?"}
    REN --> Keep
    PAR --> Keep
    Keep -->|"Yes (OR within facet, AND across facets)"| InScope["kept in results"]
    Keep -->|"No"| Dropped["filtered out"]
```
