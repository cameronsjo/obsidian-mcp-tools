# Example Prompt: Meeting Notes Template

This is an example prompt file that should be placed in your Obsidian vault's "Prompts" folder.

```md
---
name: Meeting Notes
description: Template for creating meeting notes with attendees and agenda
arguments:
  - name: title
    description: Meeting title
    required: true
  - name: date
    description: Meeting date (defaults to today if not provided)
    required: false
  - name: attendees
    description: List of attendees (comma-separated)
    required: true
---
# Meeting: <% tp.user.args.title %>
Date: <% tp.user.args.date || tp.date.now("YYYY-MM-DD") %>

## Attendees
<% tp.user.args.attendees.split(",").map(name => `- ${name.trim()}`).join("\n") %>

## Agenda
1. 

## Notes


## Action Items
- [ ] 

## Next Steps


---
Created: <% tp.file.creation_date() %>
Last modified: <% tp.file.last_modified_date("dddd Do MMMM YYYY HH:mm:ss") %>
```

## Usage Example

You can execute this prompt using the MCP server's `execute_prompt` tool:

```typescript
const result = await tools.execute_prompt({
  name: "Meeting Notes",
  arguments: {
    title: "Weekly Team Sync",
    attendees: "Alice, Bob, Charlie",
    // date is optional, will default to today
  },
  createFile: true,
  targetPath: "Meetings/Weekly Team Sync.md"
});
```

This will create a new file with the following content:

```md
# Meeting: Weekly Team Sync
Date: 2024-02-14

## Attendees
- Alice
- Bob
- Charlie

## Agenda
1. 

## Notes


## Action Items
- [ ] 

## Next Steps


---
Created: 2024-02-14 10:30
Last modified: Wednesday 14th February 2024 10:30:00
```

## Features Demonstrated

1. **Metadata**:
   - Required and optional arguments
   - Argument descriptions
   - Template name and description

2. **Templater Features**:
   - Variable substitution (`tp.user.args`)
   - Date formatting (`tp.date.now`)
   - File metadata (`tp.file`)
   - Array manipulation (splitting attendees)

3. **Practical Structure**:
   - Common meeting note sections
   - Checkbox tasks
   - Metadata footer

4. **Optional Arguments**:
   - Date defaults to current date if not provided
   - Shows how to handle optional values

This example demonstrates a real-world use case of creating structured meeting notes with dynamic content based on user input.
