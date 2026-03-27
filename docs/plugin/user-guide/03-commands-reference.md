# Commands Reference

All commands are accessible via the command palette (`Ctrl/Cmd + P`) — search for **PM:** to filter to Project Manager commands. Many commands can also be triggered from action buttons embedded in entity notes (see [`pm-actions`](04-processors/pm-actions.md)).

---

## Entity Creation Commands

### PM: Create Client

Creates a new Client note in the clients folder.

**Pre-conditions:** None.

**Modal flow:**
1. Enter the client name → the note is created at `clients/<Name>.md`

![Create Client modal](assets/modal-create-client.png)

---

### PM: Create Engagement

Creates a new Engagement note and links it to a Client.

**Pre-conditions:** At least one Client note must exist in the clients folder.

**Modal flow:**
1. Enter the engagement name
2. Select a client from the autocomplete list → the engagement is linked to the selected client

![Create Engagement modal](assets/modal-create-engagement.png)

---

### PM: Create Project

Creates a new Project note and links it to an Engagement.

**Pre-conditions:** At least one Engagement note must exist.

**Modal flow:**
1. Enter the project name
2. Select an engagement from the autocomplete list → the project is linked

![Create Project modal](assets/modal-create-project.png)

---

### PM: Create Person

Creates a new Person note and links it to a Client.

**Pre-conditions:** At least one Client note must exist.

**Modal flow:**
1. Enter the person's name
2. Select a client from the autocomplete list

![Create Person modal](assets/modal-create-person.png)

---

### PM: Create Inbox Note

Creates a lightweight capture note in the inbox folder. Inbox notes can later be promoted to Projects.

**Pre-conditions:** None (engagement selection is optional).

**Modal flow:**
1. Enter the note name
2. Optionally select an engagement

---

### PM: Create Single Meeting

Creates a Single Meeting note linked to an Engagement.

**Pre-conditions:** At least one Engagement note must exist.

**Modal flow:**
1. Enter the meeting name
2. Select an engagement
3. Enter the meeting date and time

---

### PM: Create Recurring Meeting

Creates a Recurring Meeting series note.

**Pre-conditions:** At least one Engagement note must exist.

**Modal flow:**
1. Enter the meeting series name
2. Select an engagement

---

### PM: Create Recurring Meeting Event

Creates an event instance for a Recurring Meeting.

**Pre-conditions:** At least one Recurring Meeting note must exist.

**Modal flow:**
1. Select the recurring meeting series
2. Enter the event date and time → the event note is created in a sub-folder named after the recurring meeting

---

### PM: Create Project Note

Creates a Project Note linked to a Project.

**Pre-conditions:** At least one Project note must exist.

**Modal flow:**
1. Enter the note name
2. Select a project → the note is created inside the project's notes directory and linked back to the project

---

### PM: Create RAID Item

Creates a RAID item (Risk, Assumption, Issue, or Decision).

**Pre-conditions:** None (client/engagement/owner are optional).

**Modal flow:**
1. Enter the item name
2. Select the RAID type (Risk / Assumption / Issue / Decision)
3. Optionally select an engagement and owner

![Create RAID Item modal](assets/modal-create-raid-item.png)

---

### PM: Create Reference Topic

Creates a Reference Topic note used to categorise references.

**Pre-conditions:** None.

**Modal flow:**
1. Enter the topic name

---

### PM: Create Reference

Creates a Reference document and links it to one or more Reference Topics.

**Pre-conditions:** At least one Reference Topic note must exist.

**Modal flow:**
1. Enter the reference name
2. Select one or more topics

![Create Reference modal](assets/modal-create-reference.png)

---

## Conversion Commands

### PM: Convert Inbox to Project

Promotes an Inbox Note to a full Project. The inbox note is marked as converted and the new project note inherits the engagement link.

**Pre-conditions:** The currently open note must be an Inbox Note (located in the inbox folder).

**How to invoke:** Open an Inbox Note, then run this command from the palette. No modal is shown — the conversion happens immediately.

**What changes:**
- A new Project note is created, linked to the inbox note's engagement
- The inbox note's `status` is set to `Inactive`
- The inbox note's `convertedTo` field is set to link to the new project

---

### PM: Convert Single Meeting to Recurring

Converts a Single Meeting note into a Recurring Meeting series.

**Pre-conditions:** The currently open note must be a Single Meeting (located in the single meetings folder).

**How to invoke:** Open a Single Meeting note, then run this command from the palette.

**What changes:**
- A new Recurring Meeting note is created, inheriting the engagement link
- The single meeting note is moved to the recurring meetings folder

---

## Infrastructure Commands

### PM: Set Up Vault Structure

Creates all required folders and default view files (Task Dashboard, Tasks By Project) in the utility folder. Safe to re-run on an existing vault — existing files are not overwritten.

**Pre-conditions:** None.

**How to invoke:** Command palette only (or the **Set Up Vault** button in Settings).

---

### PM: Tag Line as RAID Reference

Annotates the currently selected line in the editor with a directional RAID reference badge, linking it to a RAID item. The badge renders inline as a styled label (e.g. "↑ Mitigates", "↓ Escalates").

**Pre-conditions:** A line must be selected or the cursor must be on a line in the editor. At least one RAID item must exist.

**Modal flow:**
1. Select a RAID item
2. Select the direction: Positive, Negative, or Neutral

The annotation `{raid:positive}[[RAID Item Name]]` is appended to the line. It renders as a badge in reading view and is tracked as a backlink on the RAID item.
