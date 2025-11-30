import { describe, expect, test } from "bun:test";
import { validateVaultPath, validateOptionalPath } from "./validatePath";

describe("validateVaultPath", () => {
  test("accepts simple filenames", () => {
    expect(validateVaultPath("notes.md")).toBe("notes.md");
    expect(validateVaultPath("my-file.txt")).toBe("my-file.txt");
  });

  test("accepts nested paths", () => {
    expect(validateVaultPath("folder/file.md")).toBe("folder/file.md");
    expect(validateVaultPath("a/b/c/d.md")).toBe("a/b/c/d.md");
  });

  test("normalizes redundant slashes", () => {
    expect(validateVaultPath("folder//file.md")).toBe("folder/file.md");
    expect(validateVaultPath("a///b/c.md")).toBe("a/b/c.md");
  });

  test("removes current directory markers", () => {
    expect(validateVaultPath("./file.md")).toBe("file.md");
    expect(validateVaultPath("folder/./file.md")).toBe("folder/file.md");
  });

  test("rejects parent directory traversal", () => {
    expect(() => validateVaultPath("../file.md")).toThrow("Path traversal");
    expect(() => validateVaultPath("folder/../file.md")).toThrow("Path traversal");
    expect(() => validateVaultPath("a/b/../../c.md")).toThrow("Path traversal");
  });

  test("rejects absolute paths", () => {
    expect(() => validateVaultPath("/etc/passwd")).toThrow("Absolute paths");
    expect(() => validateVaultPath("/home/user/file.md")).toThrow("Absolute paths");
  });

  test("rejects Windows absolute paths", () => {
    expect(() => validateVaultPath("C:\\Users\\file.md")).toThrow("Absolute paths");
    expect(() => validateVaultPath("D:/Documents/file.md")).toThrow("Absolute paths");
  });

  test("rejects empty paths", () => {
    expect(() => validateVaultPath("")).toThrow("empty");
    expect(() => validateVaultPath("   ")).toThrow("empty");
  });

  test("rejects null byte injection", () => {
    expect(() => validateVaultPath("file\0.md")).toThrow("invalid characters");
    expect(() => validateVaultPath("folder/file\0name.md")).toThrow("invalid characters");
  });

  test("handles backslash paths (Windows-style)", () => {
    expect(validateVaultPath("folder\\file.md")).toBe("folder/file.md");
    expect(() => validateVaultPath("folder\\..\\file.md")).toThrow("Path traversal");
  });
});

describe("validateOptionalPath", () => {
  test("returns empty string for undefined", () => {
    expect(validateOptionalPath(undefined)).toBe("");
  });

  test("returns empty string for empty string", () => {
    expect(validateOptionalPath("")).toBe("");
    expect(validateOptionalPath("   ")).toBe("");
  });

  test("validates non-empty paths", () => {
    expect(validateOptionalPath("folder")).toBe("folder");
    expect(validateOptionalPath("a/b/c")).toBe("a/b/c");
  });

  test("rejects traversal in optional paths", () => {
    expect(() => validateOptionalPath("../folder")).toThrow("Path traversal");
  });
});
