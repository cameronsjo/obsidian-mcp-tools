import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import {
  SCOPES,
  PRESETS,
  parseScopes,
  hasScope,
  requireScope,
  describePermissions,
} from "./scopes";

describe("parseScopes", () => {
  test("returns admin for empty/undefined input (backward compatibility)", () => {
    expect(parseScopes(undefined)).toEqual([SCOPES.ADMIN]);
    expect(parseScopes("")).toEqual([SCOPES.ADMIN]);
    expect(parseScopes("  ")).toEqual([SCOPES.ADMIN]);
  });

  test("parses preset names", () => {
    expect(parseScopes("readonly")).toEqual(PRESETS.readonly);
    expect(parseScopes("editor")).toEqual(PRESETS.editor);
    expect(parseScopes("full")).toEqual(PRESETS.full);
    expect(parseScopes("admin")).toEqual(PRESETS.admin);
  });

  test("parses preset names case-insensitively", () => {
    expect(parseScopes("READONLY")).toEqual(PRESETS.readonly);
    expect(parseScopes("ReadOnly")).toEqual(PRESETS.readonly);
  });

  test("parses comma-separated scopes", () => {
    expect(parseScopes("vault:read,vault:list")).toEqual([
      SCOPES.VAULT_READ,
      SCOPES.VAULT_LIST,
    ]);
  });

  test("handles whitespace in comma-separated scopes", () => {
    expect(parseScopes("vault:read, vault:list , vault:search")).toEqual([
      SCOPES.VAULT_READ,
      SCOPES.VAULT_LIST,
      SCOPES.VAULT_SEARCH,
    ]);
  });

  test("parses wildcard scopes", () => {
    expect(parseScopes("vault:*")).toEqual([SCOPES.VAULT_ALL]);
    expect(parseScopes("plugins:*")).toEqual([SCOPES.PLUGINS_ALL]);
  });

  test("throws on invalid scope", () => {
    expect(() => parseScopes("invalid:scope")).toThrow(/Invalid scope/);
    expect(() => parseScopes("vault:read,bad:scope")).toThrow(/Invalid scope/);
  });
});

describe("hasScope", () => {
  test("returns true for exact match", () => {
    expect(hasScope([SCOPES.VAULT_READ], SCOPES.VAULT_READ)).toBe(true);
    expect(hasScope([SCOPES.VAULT_DELETE], SCOPES.VAULT_DELETE)).toBe(true);
  });

  test("returns false for missing scope", () => {
    expect(hasScope([SCOPES.VAULT_READ], SCOPES.VAULT_WRITE)).toBe(false);
    expect(hasScope([SCOPES.VAULT_READ], SCOPES.VAULT_DELETE)).toBe(false);
  });

  test("admin:* grants everything", () => {
    expect(hasScope([SCOPES.ADMIN], SCOPES.VAULT_READ)).toBe(true);
    expect(hasScope([SCOPES.ADMIN], SCOPES.VAULT_DELETE)).toBe(true);
    expect(hasScope([SCOPES.ADMIN], SCOPES.PLUGINS_EXECUTE)).toBe(true);
  });

  test("vault:* grants all vault scopes", () => {
    expect(hasScope([SCOPES.VAULT_ALL], SCOPES.VAULT_READ)).toBe(true);
    expect(hasScope([SCOPES.VAULT_ALL], SCOPES.VAULT_WRITE)).toBe(true);
    expect(hasScope([SCOPES.VAULT_ALL], SCOPES.VAULT_DELETE)).toBe(true);
    expect(hasScope([SCOPES.VAULT_ALL], SCOPES.VAULT_MOVE)).toBe(true);
    expect(hasScope([SCOPES.VAULT_ALL], SCOPES.VAULT_SEARCH)).toBe(true);
    expect(hasScope([SCOPES.VAULT_ALL], SCOPES.VAULT_LIST)).toBe(true);
  });

  test("vault:* does not grant plugin scopes", () => {
    expect(hasScope([SCOPES.VAULT_ALL], SCOPES.PLUGINS_READ)).toBe(false);
    expect(hasScope([SCOPES.VAULT_ALL], SCOPES.PLUGINS_EXECUTE)).toBe(false);
  });

  test("plugins:* grants all plugin scopes", () => {
    expect(hasScope([SCOPES.PLUGINS_ALL], SCOPES.PLUGINS_READ)).toBe(true);
    expect(hasScope([SCOPES.PLUGINS_ALL], SCOPES.PLUGINS_EXECUTE)).toBe(true);
  });

  test("plugins:* does not grant vault scopes", () => {
    expect(hasScope([SCOPES.PLUGINS_ALL], SCOPES.VAULT_READ)).toBe(false);
    expect(hasScope([SCOPES.PLUGINS_ALL], SCOPES.VAULT_DELETE)).toBe(false);
  });

  test("empty array grants nothing", () => {
    expect(hasScope([], SCOPES.VAULT_READ)).toBe(false);
  });
});

describe("requireScope", () => {
  test("does not throw when scope is granted", () => {
    expect(() => requireScope([SCOPES.VAULT_READ], SCOPES.VAULT_READ)).not.toThrow();
    expect(() => requireScope([SCOPES.ADMIN], SCOPES.VAULT_DELETE)).not.toThrow();
  });

  test("throws McpError when scope is missing", () => {
    expect(() => requireScope([SCOPES.VAULT_READ], SCOPES.VAULT_DELETE)).toThrow(
      /Permission denied.*vault:delete/
    );
  });

  test("error message includes granted scopes", () => {
    expect(() =>
      requireScope([SCOPES.VAULT_READ, SCOPES.VAULT_LIST], SCOPES.VAULT_DELETE)
    ).toThrow(/vault:read, vault:list/);
  });
});

describe("PRESETS", () => {
  test("readonly preset has correct scopes", () => {
    const readonly = PRESETS.readonly;
    expect(hasScope(readonly, SCOPES.VAULT_READ)).toBe(true);
    expect(hasScope(readonly, SCOPES.VAULT_LIST)).toBe(true);
    expect(hasScope(readonly, SCOPES.VAULT_SEARCH)).toBe(true);
    expect(hasScope(readonly, SCOPES.PLUGINS_READ)).toBe(true);

    expect(hasScope(readonly, SCOPES.VAULT_WRITE)).toBe(false);
    expect(hasScope(readonly, SCOPES.VAULT_DELETE)).toBe(false);
    expect(hasScope(readonly, SCOPES.VAULT_MOVE)).toBe(false);
    expect(hasScope(readonly, SCOPES.PLUGINS_EXECUTE)).toBe(false);
  });

  test("editor preset has correct scopes", () => {
    const editor = PRESETS.editor;
    expect(hasScope(editor, SCOPES.VAULT_READ)).toBe(true);
    expect(hasScope(editor, SCOPES.VAULT_WRITE)).toBe(true);
    expect(hasScope(editor, SCOPES.VAULT_LIST)).toBe(true);
    expect(hasScope(editor, SCOPES.VAULT_SEARCH)).toBe(true);
    expect(hasScope(editor, SCOPES.PLUGINS_READ)).toBe(true);
    expect(hasScope(editor, SCOPES.PLUGINS_EXECUTE)).toBe(true);

    expect(hasScope(editor, SCOPES.VAULT_DELETE)).toBe(false);
    expect(hasScope(editor, SCOPES.VAULT_MOVE)).toBe(false);
  });

  test("full preset has all non-admin scopes", () => {
    const full = PRESETS.full;
    expect(hasScope(full, SCOPES.VAULT_READ)).toBe(true);
    expect(hasScope(full, SCOPES.VAULT_WRITE)).toBe(true);
    expect(hasScope(full, SCOPES.VAULT_DELETE)).toBe(true);
    expect(hasScope(full, SCOPES.VAULT_MOVE)).toBe(true);
    expect(hasScope(full, SCOPES.VAULT_SEARCH)).toBe(true);
    expect(hasScope(full, SCOPES.VAULT_LIST)).toBe(true);
    expect(hasScope(full, SCOPES.PLUGINS_READ)).toBe(true);
    expect(hasScope(full, SCOPES.PLUGINS_EXECUTE)).toBe(true);
  });
});
