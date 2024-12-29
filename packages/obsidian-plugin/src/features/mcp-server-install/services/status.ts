import { Plugin } from "obsidian";
import fsp from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { InstallationStatus } from "../types";
import { logger } from "../../../logger";
import { BINARY_NAME } from "../constants";
import { getPlatform } from "./download";

const execAsync = promisify(exec);

/**
 * Checks if Claude Desktop is installed by attempting to read its config file
 */
export async function isClaudeDesktopInstalled(): Promise<boolean> {
  const platform = process.platform;
  const configPath = platform === "win32"
    ? path.join(process.env.APPDATA || "", "Claude", "claude_desktop_config.json")
    : platform === "darwin"
    ? path.join(process.env.HOME || "", "Library/Application Support/Claude/claude_desktop_config.json")
    : path.join(process.env.HOME || "", ".config/claude/config.json");

  try {
    await fsp.access(configPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets the current installation status of the MCP server
 */
export async function getInstallationStatus(plugin: Plugin): Promise<InstallationStatus> {
  try {
    const platform = getPlatform();
    const binDir = path.join(
      plugin.app.vault.adapter.basePath,
      plugin.app.vault.configDir,
      "plugins",
      plugin.manifest.id,
      "bin"
    );
    const binaryPath = path.join(binDir, BINARY_NAME[platform]);

    try {
      await fsp.access(binaryPath, fsp.constants.X_OK);

      // Get installed version
      try {
        const { stdout } = await execAsync(`"${binaryPath}" --version`);
        const installedVersion = stdout.trim();
        const pluginVersion = plugin.manifest.version;

        return {
          isInstalled: true,
          path: binaryPath,
          version: installedVersion,
          updateAvailable: installedVersion !== pluginVersion
        };
      } catch (error) {
        logger.error("Failed to get server version:", { error });
        return { isInstalled: true, path: binaryPath };
      }
    } catch {
      return { isInstalled: false };
    }
  } catch (error) {
    logger.error("Failed to check installation status:", { error });
    return { isInstalled: false };
  }
}

/**
 * Checks if the Local REST API plugin is installed and configured
 */
export function isLocalRestApiConfigured(plugin: Plugin): boolean {
  return plugin.app.plugins.plugins["obsidian-local-rest-api"]?.settings?.apiKey != null;
}
