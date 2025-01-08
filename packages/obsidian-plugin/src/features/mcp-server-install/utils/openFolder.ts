import { logger } from "$/shared/logger";
import { exec } from "child_process";
import { Notice, Platform } from "obsidian";

/**
 * Opens a folder in the system's default file explorer
 */
export function openFolder(folderPath: string): void {
  const command = Platform.isWin
    ? `start "" "${folderPath}"`
    : Platform.isMacOS
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
