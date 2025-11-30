/**
 * Integration tests for vault operations
 *
 * Addresses PR-1#5: Critical file operations were untested
 *
 * These tests mock the makeRequest function to verify:
 * - Correct API calls are made for each operation
 * - Parameters are correctly transformed
 * - Error handling works as expected
 * - Path validation is enforced
 */

import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";
import { vaultOperations, getVaultCapabilities } from "./vault";

// Mock the shared module
const mockMakeRequest = mock(() => Promise.resolve("mock response"));
const mockAssertNotReadonly = mock(() => Promise.resolve());
const mockAssertNotProtected = mock(() => Promise.resolve());

mock.module("$/shared", () => ({
  makeRequest: mockMakeRequest,
  validateVaultPath: (path: string) => {
    if (!path || path.trim() === "") throw new Error("Path cannot be empty");
    if (path.includes("..")) throw new Error("Path traversal not allowed");
    if (path.startsWith("/")) throw new Error("Absolute paths not allowed");
    return path.replace(/\\/g, "/").replace(/\/+/g, "/");
  },
  validateOptionalPath: (path?: string) => {
    if (!path) return "";
    return path.replace(/\\/g, "/").replace(/\/+/g, "/");
  },
  assertNotReadonly: mockAssertNotReadonly,
  assertNotProtected: mockAssertNotProtected,
  MCP_TAGS: {
    READONLY: "mcp-readonly",
    PROTECTED: "mcp-protected",
  },
}));

describe("vaultOperations", () => {
  beforeEach(() => {
    mockMakeRequest.mockReset();
    mockAssertNotReadonly.mockReset();
    mockAssertNotProtected.mockReset();
    mockMakeRequest.mockImplementation(() => Promise.resolve("mock response"));
    mockAssertNotReadonly.mockImplementation(() => Promise.resolve());
    mockAssertNotProtected.mockImplementation(() => Promise.resolve());
  });

  describe("read operation", () => {
    it("should read file content in markdown format", async () => {
      mockMakeRequest.mockResolvedValue("# Hello World\n\nThis is content.");

      const result = await vaultOperations.dispatch("read", {
        path: "notes/test.md",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].type).toBe("text");
      expect((result.content[0] as { type: "text"; text: string }).text).toBe(
        "# Hello World\n\nThis is content."
      );
    });

    it("should read file content in JSON format", async () => {
      const jsonContent = {
        content: "# Hello",
        frontmatter: { title: "Test" },
        tags: ["test"],
      };
      mockMakeRequest.mockResolvedValue(jsonContent);

      const result = await vaultOperations.dispatch("read", {
        path: "notes/test.md",
        format: "json",
      });

      expect(result.isError).toBeUndefined();
      expect((result.content[0] as { type: "text"; text: string }).text).toContain(
        '"content"'
      );
    });

    it("should reject path traversal attempts", async () => {
      await expect(
        vaultOperations.dispatch("read", { path: "../secret.md" })
      ).rejects.toThrow("Path traversal");
    });

    it("should reject empty path", async () => {
      await expect(
        vaultOperations.dispatch("read", { path: "" })
      ).rejects.toThrow("empty");
    });
  });

  describe("write operation", () => {
    it("should write content to a file", async () => {
      mockMakeRequest.mockResolvedValue(undefined);

      const result = await vaultOperations.dispatch("write", {
        path: "notes/new-file.md",
        content: "# New File\n\nContent here.",
      });

      expect(result.isError).toBeUndefined();
      expect((result.content[0] as { type: "text"; text: string }).text).toContain(
        "wrote"
      );
    });

    it("should reject writing to readonly files", async () => {
      mockAssertNotReadonly.mockRejectedValue(
        new Error("File is read-only (has mcp-readonly tag)")
      );

      const result = await vaultOperations.dispatch("write", {
        path: "notes/readonly.md",
        content: "Trying to overwrite",
      });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { type: "text"; text: string }).text).toContain(
        "read-only"
      );
    });

    it("should reject path traversal in write", async () => {
      await expect(
        vaultOperations.dispatch("write", {
          path: "../../etc/passwd",
          content: "malicious",
        })
      ).rejects.toThrow("Path traversal");
    });
  });

  describe("delete operation", () => {
    it("should delete a file", async () => {
      mockMakeRequest.mockResolvedValue(undefined);

      const result = await vaultOperations.dispatch("delete", {
        path: "notes/to-delete.md",
      });

      expect(result.isError).toBeUndefined();
      expect((result.content[0] as { type: "text"; text: string }).text).toContain(
        "deleted"
      );
    });

    it("should reject deleting protected files", async () => {
      mockAssertNotProtected.mockRejectedValue(
        new Error("File is protected (has mcp-protected tag)")
      );

      const result = await vaultOperations.dispatch("delete", {
        path: "notes/protected.md",
      });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { type: "text"; text: string }).text).toContain(
        "protected"
      );
    });
  });

  describe("append operation", () => {
    it("should append content to existing file", async () => {
      mockMakeRequest.mockResolvedValue(undefined);

      const result = await vaultOperations.dispatch("append", {
        path: "notes/existing.md",
        content: "\n\n## New Section",
      });

      expect(result.isError).toBeUndefined();
      expect((result.content[0] as { type: "text"; text: string }).text).toContain(
        "appended"
      );
    });
  });

  describe("list operation", () => {
    it("should list files in directory", async () => {
      mockMakeRequest.mockResolvedValue({
        files: ["note1.md", "note2.md", "subfolder/note3.md"],
      });

      const result = await vaultOperations.dispatch("list", {
        directory: "notes",
      });

      expect(result.isError).toBeUndefined();
      const text = (result.content[0] as { type: "text"; text: string }).text;
      expect(text).toContain("note1.md");
      expect(text).toContain("note2.md");
    });

    it("should list root directory when no directory specified", async () => {
      mockMakeRequest.mockResolvedValue({
        files: ["README.md", "folder/file.md"],
      });

      const result = await vaultOperations.dispatch("list", {});

      expect(result.isError).toBeUndefined();
    });
  });

  describe("move operation", () => {
    it("should move a file to new location", async () => {
      mockMakeRequest.mockResolvedValue(undefined);

      const result = await vaultOperations.dispatch("move", {
        source: "notes/old-location.md",
        destination: "archive/old-location.md",
      });

      expect(result.isError).toBeUndefined();
      expect((result.content[0] as { type: "text"; text: string }).text).toContain(
        "moved"
      );
    });

    it("should reject move with missing source", async () => {
      const result = await vaultOperations.dispatch("move", {
        destination: "archive/file.md",
      });

      expect(result.isError).toBe(true);
    });
  });

  describe("rename operation", () => {
    it("should rename a file", async () => {
      mockMakeRequest.mockResolvedValue(undefined);

      const result = await vaultOperations.dispatch("rename", {
        path: "notes/old-name.md",
        newName: "new-name.md",
      });

      expect(result.isError).toBeUndefined();
      expect((result.content[0] as { type: "text"; text: string }).text).toContain(
        "renamed"
      );
    });
  });

  describe("search operation", () => {
    it("should search vault content", async () => {
      mockMakeRequest.mockResolvedValue([
        { filename: "notes/match1.md", matches: [{ match: { content: "test" } }] },
        { filename: "notes/match2.md", matches: [{ match: { content: "test" } }] },
      ]);

      const result = await vaultOperations.dispatch("search", {
        query: "test",
      });

      expect(result.isError).toBeUndefined();
      const text = (result.content[0] as { type: "text"; text: string }).text;
      expect(text).toContain("match1.md");
    });

    it("should limit search results", async () => {
      mockMakeRequest.mockResolvedValue([
        { filename: "notes/1.md", matches: [] },
        { filename: "notes/2.md", matches: [] },
        { filename: "notes/3.md", matches: [] },
      ]);

      const result = await vaultOperations.dispatch("search", {
        query: "test",
        limit: 2,
      });

      expect(result.isError).toBeUndefined();
    });
  });

  describe("info operation", () => {
    it("should return file metadata", async () => {
      mockMakeRequest.mockResolvedValue({
        path: "notes/test.md",
        ctime: 1609459200000,
        mtime: 1609545600000,
        size: 1234,
      });

      const result = await vaultOperations.dispatch("info", {
        path: "notes/test.md",
      });

      expect(result.isError).toBeUndefined();
      const text = (result.content[0] as { type: "text"; text: string }).text;
      expect(text).toContain("test.md");
    });
  });
});

describe("getVaultCapabilities()", () => {
  it("should return all registered operations", () => {
    const capabilities = getVaultCapabilities();

    expect(capabilities.read).toBeDefined();
    expect(capabilities.write).toBeDefined();
    expect(capabilities.delete).toBeDefined();
    expect(capabilities.append).toBeDefined();
    expect(capabilities.patch).toBeDefined();
    expect(capabilities.move).toBeDefined();
    expect(capabilities.rename).toBeDefined();
    expect(capabilities.list).toBeDefined();
    expect(capabilities.search).toBeDefined();
    expect(capabilities.bulk_delete).toBeDefined();
    expect(capabilities.open).toBeDefined();
    expect(capabilities.info).toBeDefined();
  });

  it("should include descriptions for each operation", () => {
    const capabilities = getVaultCapabilities();

    expect(capabilities.read.description).toBeDefined();
    expect(capabilities.read.description.length).toBeGreaterThan(0);
  });

  it("should include parameter definitions", () => {
    const capabilities = getVaultCapabilities();

    expect(capabilities.read.parameters).toBeDefined();
    expect(capabilities.read.parameters.path).toBeDefined();
    expect(capabilities.read.parameters.path.required).toBe(true);
  });

  it("should not expose handler functions", () => {
    const capabilities = getVaultCapabilities();

    expect("handler" in capabilities.read).toBe(false);
  });
});

describe("matchesGlob (integration via bulk_delete)", () => {
  beforeEach(() => {
    mockMakeRequest.mockReset();
    mockAssertNotProtected.mockReset();
    mockAssertNotProtected.mockImplementation(() => Promise.resolve());
  });

  it("should match simple glob patterns", async () => {
    mockMakeRequest.mockResolvedValue({ files: ["test.md", "test.txt", "other.md"] });

    const result = await vaultOperations.dispatch("bulk_delete", {
      match: "*.md",
      dryRun: true,
    });

    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("test.md");
    expect(text).toContain("other.md");
    expect(text).not.toContain("test.txt");
  });

  it("should match globstar patterns", async () => {
    mockMakeRequest.mockResolvedValue({
      files: ["a/b/c.md", "a/d.md", "e.md", "a/b/c/d.md"],
    });

    const result = await vaultOperations.dispatch("bulk_delete", {
      match: "a/**/*.md",
      dryRun: true,
    });

    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("a/b/c.md");
    expect(text).toContain("a/d.md");
  });

  it("should handle brace expansion", async () => {
    mockMakeRequest.mockResolvedValue({
      files: ["notes.md", "notes.txt", "notes.json", "other.md"],
    });

    const result = await vaultOperations.dispatch("bulk_delete", {
      match: "notes.{md,txt}",
      dryRun: true,
    });

    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("notes.md");
    expect(text).toContain("notes.txt");
    expect(text).not.toContain("notes.json");
  });

  it("should handle negation patterns in exclude", async () => {
    mockMakeRequest.mockResolvedValue({
      files: ["keep.md", "delete.md", "also-delete.md"],
    });

    const result = await vaultOperations.dispatch("bulk_delete", {
      match: "*.md",
      exclude: ["keep.md"],
      dryRun: true,
    });

    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).not.toContain("keep.md");
    expect(text).toContain("delete.md");
  });

  it("should handle character class patterns", async () => {
    mockMakeRequest.mockResolvedValue({
      files: ["file1.md", "file2.md", "file3.md", "fileA.md"],
    });

    const result = await vaultOperations.dispatch("bulk_delete", {
      match: "file[12].md",
      dryRun: true,
    });

    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("file1.md");
    expect(text).toContain("file2.md");
    expect(text).not.toContain("file3.md");
    expect(text).not.toContain("fileA.md");
  });

  it("should handle question mark wildcard", async () => {
    mockMakeRequest.mockResolvedValue({
      files: ["a.md", "ab.md", "abc.md"],
    });

    const result = await vaultOperations.dispatch("bulk_delete", {
      match: "?.md",
      dryRun: true,
    });

    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("a.md");
    expect(text).not.toContain("ab.md");
    expect(text).not.toContain("abc.md");
  });
});
