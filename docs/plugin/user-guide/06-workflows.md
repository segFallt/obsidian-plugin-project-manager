# Workflows

End-to-end walkthroughs of common operations. Each workflow builds on the previous one — if you're new, start with workflow 1.

---

## 1. Onboarding a New Client and Engagement

**Scenario:** You've just taken on a new client. Set up their workspace from scratch.

**Steps:**

1. **Create the client** — open the command palette (`Ctrl/Cmd + P`), run **PM: Create Client**, and enter the client name (e.g. `Acme Corp`). The client note opens immediately.

2. **Add contact details** — the `pm-properties` block in the client note lets you fill in the contact name, email, phone, and status directly. Click any field to edit it.

3. **Create an engagement** — run **PM: Create Engagement** from the palette. Enter the engagement name. In the client autocomplete, select `Acme Corp`. The engagement note opens linked to the client.

4. **Add engagement details** — set the start and end dates and a brief description in `pm-properties`.

5. **Create a project** — run **PM: Create Project**, enter a name, and select the engagement. The project note opens linked to the engagement.

6. **Verify the hierarchy** — open the client note. The `pm-entity-view` section shows the new engagement. Open the engagement note — it shows the new project.

---

## 2. Running a Recurring Meeting

**Scenario:** Your team holds a weekly standup. Set it up so each session is a linked note and all actions are tracked.

**Steps:**

1. **Create the recurring meeting** — run **PM: Create Recurring Meeting**, enter the series name (e.g. `Weekly Standup`), and select the engagement. The series note opens with a `pm-recurring-events` block.

2. **Create the first event** — run **PM: Create Recurring Meeting Event**, select `Weekly Standup` as the parent, and enter the meeting date and time. An event note opens inside `meetings/recurring-events/Weekly Standup/`.

3. **Add meeting notes** — in the event note, add a `# Notes` section with bullet points summarising the discussion. These notes appear in the tile grid on the recurring meeting note.

4. **Add tasks** — add `- [ ] Action item 📅 YYYY-MM-DD` lines to the event note. They appear in the task dashboard automatically.

5. **Track progress** — open `utility/Task Dashboard`. Filter by **Context Type → Recurring Meeting** to see all actions from this standup series.

6. **Next week** — repeat from step 2. The tile grid shows all events newest-first, so the current week is always at the top.

---

## 3. Logging and Tracking a RAID Item

**Scenario:** A risk has been identified during a project. Log it, annotate it in your notes, and track it on the RAID dashboard.

**Steps:**

1. **Create the RAID item** — run **PM: Create RAID Item**, enter the risk name (e.g. `API Rate Limit Breach`), select type **Risk**, select the engagement, and assign an owner.

2. **Fill in the details** — the RAID item note opens. Use `pm-properties` to set Likelihood, Impact, and Status, and add a description.

3. **Annotate a related note** — open the note where the risk was discussed (e.g. a meeting note). Place your cursor on the relevant line. Run **PM: Tag Line as RAID Reference**, select `API Rate Limit Breach`, and choose **Negative** as the direction.

   The line now has `{raid:negative}[[API Rate Limit Breach]]` appended. In reading view, it renders as a badge: `↓ Escalates`.

4. **View all references** — open the RAID item note. The `pm-raid-references` block lists all notes that reference it, with the direction badge and linked line text.

5. **Monitor on the dashboard** — open a note with a `pm-raid-dashboard` block (or add one to any note). The risk appears in the matrix at the appropriate likelihood × impact cell. Click the cell to filter to just that risk tier.

6. **Close the item** — when resolved, open the RAID item note and change its status to **Resolved** in `pm-properties`. The `closed-date` field is set automatically.

---

## 4. Converting an Inbox Note to a Project

**Scenario:** You captured an idea in an Inbox Note and it has grown into a real piece of work. Promote it to a Project.

**Steps:**

1. **Create an Inbox Note** (if you haven't already) — run **PM: Create Inbox Note**, enter a name, and optionally link it to an engagement.

2. **Develop the idea** — add notes, thoughts, and early tasks directly to the inbox note body.

3. **Promote to a project** — open the inbox note. Run **PM: Convert Inbox to Project** from the command palette.

   The plugin creates a new Project note linked to the same engagement, sets the inbox note's status to `Inactive`, and sets its `convertedTo` field to link to the new project.

4. **Continue in the project** — the new project note opens. Add proper frontmatter (priority, dates), add project notes using **PM: Create Project Note**, and start tracking tasks.

---

## 5. Creating and Browsing References

**Scenario:** You've encountered a useful technical pattern or guide. Save it as a Reference so you can find it again later.

**Steps:**

1. **Create a Reference Topic** (if needed) — run **PM: Create Reference Topic** and enter a name (e.g. `Security`). Topics are tags you'll use to categorise references.

2. **Create the reference** — run **PM: Create Reference**, enter the reference name (e.g. `JWT Best Practices`), and select one or more topics. The reference note opens.

3. **Add the content** — write or paste the reference material in the note body. You can use standard Markdown, code blocks, tables, and wikilinks.

4. **Browse references** — open any note that has a `pm-references` block (or add one to a hub note). Switch between **By Topic**, **By Client**, and **By Engagement** tabs to find references. Use the search input to filter by name.

---

## 6. Managing Tasks Across a Programme

**Scenario:** You're working across multiple projects and need a single view of all your open actions, prioritised and filtered.

**Steps:**

1. **Open the task dashboard** — navigate to `utility/Task Dashboard`. All vault tasks are shown in Context view by default.

2. **Filter by engagement** — click **⚙ Filters** to open the filter drawer. Expand the **Client / Engagement** section and select the engagement you want to focus on. The view updates immediately.

3. **Sort by due date** — in the **Sort Order** section, add **Due Date** as the first sort key (ascending). Tasks with the nearest due dates appear first.

4. **Find overdue tasks** — in the **Due Date** section, click the **Overdue** preset pill. The filter chips bar shows the active filter. Click **✕** on the chip or **Clear All Filters** when you're done.

5. **Complete a task** — click a task's checkbox directly in the dashboard. The task is marked complete in the source file and a completion date is added.

6. **Review by project** — switch to `utility/Tasks By Project` to see tasks grouped under each project. Use the status filter checkboxes to hide projects you aren't actively working on.
