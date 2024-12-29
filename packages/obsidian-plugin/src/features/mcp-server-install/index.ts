import { Notice, Plugin } from "obsidian";
import { SetupResult } from "./types";
import { installMcpServer } from "./services/download";
import { updateClaudeConfig } from "./services/config";
import { McpServerSettingsTab } from "./components/SettingsTab";
import { logger } from "../../logger";

export async function setup(plugin: Plugin): Promise<SetupResult> {
  try {
    // Add settings tab
    plugin.addSettingTab(new McpServerSettingsTab(plugin.app, plugin));

    // Add command to install MCP server
    plugin.addCommand({
      id: "setup-mcp-server",
      name: "Download and install MCP server",
      callback: async () => {
        try {
          // Install server binary
          await installMcpServer(plugin);

          // Get server path
          const binDir = `${plugin.app.vault.adapter.basePath}/${plugin.app.vault.configDir}/plugins/${plugin.manifest.id}/bin`;
          const serverPath = `${binDir}/mcp-server`;

          // Update Claude config
          await updateClaudeConfig(plugin, serverPath);

          new Notice("MCP server installed and configured successfully!");
          logger.info("MCP server setup complete", { serverPath });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          new Notice(`Failed to setup MCP server: ${errorMessage}`);
          logger.error("Setup failed:", { error });
          return {
            success: false,
            error: errorMessage
          };
        }
      },
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Re-export types and utilities that should be available to other features
export * from "./types";
export * from "./constants";
export { installMcpServer } from "./services/download";
export { updateClaudeConfig } from "./services/config";
export { uninstallServer } from "./services/uninstall";
export { McpServerSettingsTab } from "./components/SettingsTab";
