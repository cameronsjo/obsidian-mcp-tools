import { exec } from "child_process";
import { Notice } from "obsidian";
import { logger } from "../../../logger";

/**
 * Opens a folder in the system's default file explorer
 */
export function openFolder(folderPath: string): void {
  const platform = process.platform;
  const command = platform === "win32"
    ? `start "" "${folderPath}"`
    : platform === "darwin"
      ? `open "${folderPath}"`
      : `xdg-open "${folderPath}"`;

  exec(command, (error: Error | null) => {
    if (error) {
      const message = `Failed to open folder: ${error.message}`;
      logger.error(message, { folderPath, error });
      new Notice(message);
    }
  });
}
