/**
 * Unit tests for config merging
 *
 * Addresses PR-1#6: mergeConfig() deep merge behavior was untested
 */

import { describe, expect, it, beforeEach } from "bun:test";
import {
  mergeConfig,
  configManager,
  DEFAULT_CONFIG,
  type DispatcherConfig,
} from "./config";

describe("mergeConfig()", () => {
  describe("with empty config", () => {
    it("should return default config when given empty object", () => {
      const result = mergeConfig({});
      expect(result).toEqual(DEFAULT_CONFIG);
    });

    it("should return default config when given undefined", () => {
      const result = mergeConfig(undefined);
      expect(result).toEqual(DEFAULT_CONFIG);
    });
  });

  describe("dispatchers merging", () => {
    it("should merge dispatcher overrides", () => {
      const result = mergeConfig({
        dispatchers: { vault: false },
      });

      expect(result.dispatchers.vault).toBe(false);
      expect(result.dispatchers.activeFile).toBe(true); // default preserved
      expect(result.dispatchers.plugin).toBe(true);
      expect(result.dispatchers.discover).toBe(true);
    });

    it("should handle all dispatchers disabled", () => {
      const result = mergeConfig({
        dispatchers: {
          vault: false,
          activeFile: false,
          plugin: false,
          discover: false,
        },
      });

      expect(result.dispatchers.vault).toBe(false);
      expect(result.dispatchers.activeFile).toBe(false);
      expect(result.dispatchers.plugin).toBe(false);
      expect(result.dispatchers.discover).toBe(false);
    });
  });

  describe("plugins deep merging", () => {
    it("should merge official plugin overrides", () => {
      const result = mergeConfig({
        plugins: {
          official: { "smart-connections": false },
        },
      });

      expect(result.plugins.official["smart-connections"]).toBe(false);
      expect(result.plugins.official.templater).toBe(true); // default preserved
    });

    it("should add new official plugins", () => {
      const result = mergeConfig({
        plugins: {
          official: { "new-plugin": true },
        },
      });

      expect(result.plugins.official["new-plugin"]).toBe(true);
      expect(result.plugins.official["smart-connections"]).toBe(true);
      expect(result.plugins.official.templater).toBe(true);
    });

    it("should preserve autoDetect default when not specified", () => {
      const result = mergeConfig({
        plugins: { official: {} },
      });

      expect(result.plugins.autoDetect).toBe(true);
    });

    it("should override autoDetect", () => {
      const result = mergeConfig({
        plugins: { autoDetect: false },
      });

      expect(result.plugins.autoDetect).toBe(false);
    });

    it("should replace declared plugins array", () => {
      const declared = [
        {
          id: "custom",
          name: "Custom Plugin",
          endpoints: { action: { method: "POST" as const, path: "/custom" } },
        },
      ];

      const result = mergeConfig({
        plugins: { declared },
      });

      expect(result.plugins.declared).toEqual(declared);
    });

    it("should use empty array when declared not specified", () => {
      const result = mergeConfig({});
      expect(result.plugins.declared).toEqual([]);
    });
  });

  describe("legacy merging", () => {
    it("should merge legacy overrides", () => {
      const result = mergeConfig({
        legacy: { enabled: false },
      });

      expect(result.legacy.enabled).toBe(false);
      expect(result.legacy.disabled).toEqual([]); // default preserved
    });

    it("should merge disabled tools list", () => {
      const result = mergeConfig({
        legacy: { disabled: ["tool1", "tool2"] },
      });

      expect(result.legacy.enabled).toBe(true); // default preserved
      expect(result.legacy.disabled).toEqual(["tool1", "tool2"]);
    });
  });

  describe("full config merging", () => {
    it("should merge complex nested config", () => {
      const userConfig: DispatcherConfig = {
        dispatchers: { vault: false },
        plugins: {
          autoDetect: false,
          official: { templater: false, "new-one": true },
          declared: [
            {
              id: "my-plugin",
              name: "My Plugin",
              endpoints: { get: { method: "GET", path: "/my" } },
            },
          ],
        },
        legacy: { enabled: false, disabled: ["old_tool"] },
      };

      const result = mergeConfig(userConfig);

      // Dispatchers
      expect(result.dispatchers.vault).toBe(false);
      expect(result.dispatchers.activeFile).toBe(true);

      // Plugins
      expect(result.plugins.autoDetect).toBe(false);
      expect(result.plugins.official["smart-connections"]).toBe(true);
      expect(result.plugins.official.templater).toBe(false);
      expect(result.plugins.official["new-one"]).toBe(true);
      expect(result.plugins.declared).toHaveLength(1);
      expect(result.plugins.declared[0].id).toBe("my-plugin");

      // Legacy
      expect(result.legacy.enabled).toBe(false);
      expect(result.legacy.disabled).toEqual(["old_tool"]);
    });
  });
});

describe("ConfigManager", () => {
  beforeEach(() => {
    // Reset to defaults
    configManager.load({});
  });

  describe("load()", () => {
    it("should load and merge config", () => {
      configManager.load({ dispatchers: { vault: false } });

      expect(configManager.isDispatcherEnabled("vault")).toBe(false);
      expect(configManager.isDispatcherEnabled("activeFile")).toBe(true);
    });
  });

  describe("get()", () => {
    it("should return current config", () => {
      const config = configManager.get();

      expect(config.dispatchers).toBeDefined();
      expect(config.plugins).toBeDefined();
      expect(config.legacy).toBeDefined();
    });
  });

  describe("isDispatcherEnabled()", () => {
    it("should return true for enabled dispatchers", () => {
      expect(configManager.isDispatcherEnabled("vault")).toBe(true);
    });

    it("should return false for disabled dispatchers", () => {
      configManager.load({ dispatchers: { plugin: false } });
      expect(configManager.isDispatcherEnabled("plugin")).toBe(false);
    });
  });

  describe("isAutoDetectEnabled()", () => {
    it("should return default true", () => {
      expect(configManager.isAutoDetectEnabled()).toBe(true);
    });

    it("should return false when disabled", () => {
      configManager.load({ plugins: { autoDetect: false } });
      expect(configManager.isAutoDetectEnabled()).toBe(false);
    });
  });

  describe("isOfficialPluginEnabled()", () => {
    it("should return true for enabled plugins", () => {
      expect(configManager.isOfficialPluginEnabled("smart-connections")).toBe(true);
    });

    it("should return false for disabled plugins", () => {
      configManager.load({ plugins: { official: { templater: false } } });
      expect(configManager.isOfficialPluginEnabled("templater")).toBe(false);
    });

    it("should return true for unknown plugins (permissive default)", () => {
      expect(configManager.isOfficialPluginEnabled("unknown-plugin")).toBe(true);
    });
  });

  describe("getDeclaredPlugins()", () => {
    it("should return empty array by default", () => {
      expect(configManager.getDeclaredPlugins()).toEqual([]);
    });

    it("should return declared plugins", () => {
      const declared = [
        {
          id: "test",
          name: "Test",
          endpoints: { foo: { method: "GET" as const, path: "/test" } },
        },
      ];
      configManager.load({ plugins: { declared } });

      expect(configManager.getDeclaredPlugins()).toEqual(declared);
    });
  });

  describe("isLegacyEnabled()", () => {
    it("should return true by default", () => {
      expect(configManager.isLegacyEnabled()).toBe(true);
    });

    it("should return false when disabled", () => {
      configManager.load({ legacy: { enabled: false } });
      expect(configManager.isLegacyEnabled()).toBe(false);
    });
  });

  describe("isLegacyToolDisabled()", () => {
    it("should return false for tools not in disabled list", () => {
      expect(configManager.isLegacyToolDisabled("some_tool")).toBe(false);
    });

    it("should return true for tools in disabled list", () => {
      configManager.load({ legacy: { disabled: ["old_tool", "deprecated_tool"] } });

      expect(configManager.isLegacyToolDisabled("old_tool")).toBe(true);
      expect(configManager.isLegacyToolDisabled("deprecated_tool")).toBe(true);
      expect(configManager.isLegacyToolDisabled("other_tool")).toBe(false);
    });
  });
});
