# Templater Notes

## Syntax
- Templates use `<% %>` syntax for variables and functions
- The `tp` object provides access to built-in functions
- JavaScript code can be executed within template syntax

## Example
```md
---
creation date: <% tp.file.creation_date() %>
modification date: <% tp.file.last_modified_date("dddd Do MMMM YYYY HH:mm:ss") %>
---

# <% tp.file.title %>

<% tp.web.daily_quote() %>
```

## Key Features
- File operations (tp.file)
- Date manipulation (tp.date)
- Web content (tp.web)
- JavaScript execution
- Variable substitution
