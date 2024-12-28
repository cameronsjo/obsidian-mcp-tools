# Prompt Feature Implementation Guide

## Overview

Add functionality to load and execute prompts stored as markdown files in Obsidian.

## Implementation Areas

### 1. MCP Server

Add prompt management:

- List prompts from Obsidian's "Prompts" folder
- Parse frontmatter for prompt metadata
- Validate prompt arguments

#### Schemas

```typescript
interface PromptMetadata {
  name: string;
  description?: string;
  arguments?: {
    name: string;
    description?: string;
    required?: boolean;
  }[];
}

interface ExecutePromptParams {
  name: string;
  arguments: Record<string, string>;
  createFile?: boolean;
  targetPath?: string;
}
```

### 2. Obsidian Plugin

Add new endpoint `/prompts/execute`:

```typescript
// Add to plugin-apis.ts
export const loadTemplaterAPI = loadPluginAPI(
  () => app.plugins.plugins["templater-obsidian"]?.templater
);

// Add to main.ts
this.localRestApi
  .addRoute("/prompts/execute")
  .post(this.handlePromptExecution.bind(this));
```

### 3. OpenAPI Updates

Add to openapi.yaml:

```yaml
/prompts/execute:
  post:
    summary: Execute a prompt template
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ExecutePromptParams"
    responses:
      200:
        description: Prompt executed successfully
        content:
          text/plain:
            schema:
              type: string
```
