/**
 * Active File Dispatcher
 *
 * Consolidates active file operations into a single dispatcher tool:
 * - read: get_active_file
 * - update: update_active_file
 * - append: append_to_active_file
 * - patch: patch_active_file
 * - delete: delete_active_file
 */

import { makeRequest, MCP_TAGS } from "$/shared";
import { LocalRestAPI } from "shared";
import { OperationRegistry, type OperationResult } from "./types";

export const activeFileOperations = new OperationRegistry();

// READ operation
activeFileOperations.register({
  name: "read",
  description: "Get the content of the currently active file in Obsidian",
  parameters: {
    format: {
      type: '"markdown" | "json"',
      description: "Output format (default: markdown)",
    },
  },
  handler: async (params): Promise<OperationResult> => {
    const format =
      params.format === "json"
        ? "application/vnd.olrapi.note+json"
        : "text/markdown";

    const data = await makeRequest(
      LocalRestAPI.ApiNoteJson.or("string"),
      "/active/",
      { headers: { Accept: format } },
    );

    const content =
      typeof data === "string" ? data : JSON.stringify(data, null, 2);

    return { content: [{ type: "text", text: content }] };
  },
});

// UPDATE operation
activeFileOperations.register({
  name: "update",
  description: "Replace the content of the active file. Respects mcp-readonly tag.",
  parameters: {
    content: { type: "string", description: "New file content", required: true },
  },
  handler: async (params): Promise<OperationResult> => {
    // Check if active file is readonly
    const activeFile = await makeRequest(LocalRestAPI.ApiNoteJson, "/active/", {
      headers: { Accept: "application/vnd.olrapi.note+json" },
    });

    if (activeFile.tags?.includes(MCP_TAGS.READONLY)) {
      return {
        content: [
          {
            type: "text",
            text: `Cannot update: file is read-only (has ${MCP_TAGS.READONLY} tag)`,
          },
        ],
        isError: true,
      };
    }

    await makeRequest(LocalRestAPI.ApiNoContentResponse, "/active/", {
      method: "PUT",
      body: params.content as string,
    });

    return {
      content: [{ type: "text", text: "File updated successfully" }],
    };
  },
});

// APPEND operation
activeFileOperations.register({
  name: "append",
  description: "Append content to the active file. Respects mcp-readonly tag.",
  parameters: {
    content: { type: "string", description: "Content to append", required: true },
  },
  handler: async (params): Promise<OperationResult> => {
    const activeFile = await makeRequest(LocalRestAPI.ApiNoteJson, "/active/", {
      headers: { Accept: "application/vnd.olrapi.note+json" },
    });

    if (activeFile.tags?.includes(MCP_TAGS.READONLY)) {
      return {
        content: [
          {
            type: "text",
            text: `Cannot append: file is read-only (has ${MCP_TAGS.READONLY} tag)`,
          },
        ],
        isError: true,
      };
    }

    await makeRequest(LocalRestAPI.ApiNoContentResponse, "/active/", {
      method: "POST",
      body: params.content as string,
    });

    return {
      content: [{ type: "text", text: "Content appended successfully" }],
    };
  },
});

// PATCH operation
activeFileOperations.register({
  name: "patch",
  description:
    "Insert or modify content relative to a heading, block, or frontmatter. Respects mcp-readonly tag.",
  parameters: {
    operation: {
      type: '"append" | "prepend" | "replace"',
      description: "How to modify the target",
      required: true,
    },
    targetType: {
      type: '"heading" | "block" | "frontmatter"',
      description: "Type of target",
      required: true,
    },
    target: { type: "string", description: "Target identifier", required: true },
    content: { type: "string", description: "Content to insert", required: true },
    targetDelimiter: { type: "string", description: "Delimiter for nested targets" },
    trimTargetWhitespace: { type: "boolean", description: "Trim whitespace" },
    contentType: { type: "string", description: "Content type header" },
  },
  handler: async (params): Promise<OperationResult> => {
    const activeFile = await makeRequest(LocalRestAPI.ApiNoteJson, "/active/", {
      headers: { Accept: "application/vnd.olrapi.note+json" },
    });

    if (activeFile.tags?.includes(MCP_TAGS.READONLY)) {
      return {
        content: [
          {
            type: "text",
            text: `Cannot patch: file is read-only (has ${MCP_TAGS.READONLY} tag)`,
          },
        ],
        isError: true,
      };
    }

    const headers: Record<string, string> = {
      Operation: params.operation as string,
      "Target-Type": params.targetType as string,
      Target: params.target as string,
      "Create-Target-If-Missing": "true",
    };

    if (params.targetDelimiter) {
      headers["Target-Delimiter"] = params.targetDelimiter as string;
    }
    if (params.trimTargetWhitespace !== undefined) {
      headers["Trim-Target-Whitespace"] = String(params.trimTargetWhitespace);
    }
    if (params.contentType) {
      headers["Content-Type"] = params.contentType as string;
    }

    const response = await makeRequest(
      LocalRestAPI.ApiContentResponse,
      "/active/",
      { method: "PATCH", headers, body: params.content as string },
    );

    return {
      content: [
        { type: "text", text: "File patched successfully" },
        { type: "text", text: response },
      ],
    };
  },
});

// DELETE operation
activeFileOperations.register({
  name: "delete",
  description: "Delete the currently active file. Respects mcp-protected tag.",
  parameters: {},
  handler: async (): Promise<OperationResult> => {
    const activeFile = await makeRequest(LocalRestAPI.ApiNoteJson, "/active/", {
      headers: { Accept: "application/vnd.olrapi.note+json" },
    });

    if (activeFile.tags?.includes(MCP_TAGS.PROTECTED)) {
      return {
        content: [
          {
            type: "text",
            text: `Cannot delete: file is protected (has ${MCP_TAGS.PROTECTED} tag)`,
          },
        ],
        isError: true,
      };
    }

    await makeRequest(LocalRestAPI.ApiNoContentResponse, "/active/", {
      method: "DELETE",
    });

    return {
      content: [{ type: "text", text: "File deleted successfully" }],
    };
  },
});

/**
 * Get capabilities for the active_file dispatcher
 */
export function getActiveFileCapabilities() {
  return {
    category: "active_file",
    description: "Operations on the currently active file in Obsidian",
    operations: activeFileOperations.getCapabilities(),
  };
}
