import { Plugin } from "obsidian";
import fsp from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import type { InstallationStatus } from "../types";
import { logger } from "../../../shared/logger";
import { BINARY_NAME } from "../constants";
import { getPlatform } from "./download";

const execAsync = promisify(exec);

/**
 * Checks if Claude Desktop is installed by attempting to read its config file
 */
export async function isClaudeDesktopInstalled(): Promise<boolean> {
  const platform = process.platform;
  const configPath =
    platform === "win32"
      ? path.join(
          process.env.APPDATA || "",
          "Claude",
          "claude_desktop_config.json",
        )
      : platform === "darwin"
        ? path.join(
            process.env.HOME || "",
            "Library/Application Support/Claude/claude_desktop_config.json",
          )
        : path.join(process.env.HOME || "", ".config/claude/config.json");

  try {
    await fsp.access(configPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves the real path of the given file path, handling cases where the path is a symlink.
 *
 * @param filepath - The file path to resolve.
 * @returns The real path of the file.
 * @throws {Error} If the file is not found or the symlink cannot be resolved.
 */
async function resolveSymlinks(filepath: string): Promise<string> {
  try {
    return await fsp.realpath(filepath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      const parts = path.normalize(filepath).split(path.sep);
      let resolvedParts: string[] = [];
      let skipCount = 1; // Skip first segment by default

      // Handle the root segment differently for Windows vs POSIX
      if (path.win32.isAbsolute(filepath)) {
        resolvedParts.push(parts[0]);
        if (parts[1] === "") {
          resolvedParts.push("");
          skipCount = 2; // Skip two segments for UNC paths
        }
      } else if (path.posix.isAbsolute(filepath)) {
        resolvedParts.push("/");
      } else {
        resolvedParts.push(parts[0]);
      }

      // Process remaining path segments
      for (const part of parts.slice(skipCount)) {
        const partialPath = path.join(...resolvedParts, part);
        try {
          const resolvedPath = await fsp.realpath(partialPath);
          resolvedParts = resolvedPath.split(path.sep);
        } catch (err) {
          resolvedParts.push(part);
        }
      }

      return path.join(...resolvedParts);
    }

    logger.error(`Failed to resolve symlink:`, {
      filepath,
      error: error instanceof Error ? error.message : error,
    });
    throw new Error(`Failed to resolve symlink: ${filepath}`);
  }
}

export async function getInstallPath(plugin: Plugin): Promise<{
  dir: string;
  path: string;
  name: string;
  symlinked?: string;
}> {
  const platform = getPlatform();
  const originalPath = path.join(
    plugin.app.vault.adapter.basePath,
    plugin.app.vault.configDir,
    "plugins",
    plugin.manifest.id,
    "bin",
  );
  const realpath = await resolveSymlinks(originalPath);
  const filename = BINARY_NAME[platform];
  const filepath = path.join(realpath, filename);
  return {
    dir: realpath,
    path: filepath,
    name: filename,
    symlinked: originalPath === realpath ? undefined : originalPath,
  };
}

/**
 * Gets the current installation status of the MCP server
 */
export async function getInstallationStatus(
  plugin: Plugin,
): Promise<InstallationStatus> {
  try {
    const installPath = await getInstallPath(plugin);
    logger.debug("Checking installation status:", { installPath });

    try {
      await fsp.access(installPath.path, fsp.constants.X_OK);
      logger.debug("Server binary found:", { installPath });

      // Get installed version
      try {
        const versionCommand = `"${installPath.path}" --version`;
        logger.debug("Getting server version:", { versionCommand });
        const { stdout } = await execAsync(versionCommand);
        const installedVersion = stdout.trim();
        const pluginVersion = plugin.manifest.version;
        logger.debug("Got server version:", {
          installedVersion,
          pluginVersion,
        });

        return {
          isInstalled: true,
          path: installPath.path,
          dir: installPath.dir,
          version: installedVersion,
          updateAvailable: installedVersion !== pluginVersion,
        };
      } catch (error) {
        logger.error("Failed to get server version:", { error });
        return { isInstalled: true, path: installPath.path };
      }
    } catch (error) {
      logger.debug("Server binary not found:", {
        installPath,
        error: error instanceof Error ? error.message : error,
      });
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
  return (
    plugin.app.plugins.plugins["obsidian-local-rest-api"]?.settings?.apiKey !=
    null
  );
}
