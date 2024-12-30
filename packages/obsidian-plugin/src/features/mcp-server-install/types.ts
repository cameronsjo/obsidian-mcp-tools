import type { Templater } from "shared";

export interface SetupResult {
  success: boolean;
  error?: string;
}

export interface DownloadProgress {
  percentage: number;
  bytesReceived: number;
  totalBytes: number;
}

export interface InstallationStatus {
  isInstalled: boolean;
  version?: string;
  path?: string;
  dir?: string;
  updateAvailable?: boolean;
  isInstalling?: boolean;
}

// Augment Obsidian's App type to include plugins
declare module "obsidian" {
  interface DataAdapter {
    /** The absolute directory path for the Obsidian vault. */
    basePath: string;
  }

  interface App {
    plugins: {
      plugins: {
        ["obsidian-local-rest-api"]?: {
          settings?: {
            apiKey?: string;
          };
        };
        ["smart-connections"]?: Plugin;
        ["templater-obsidian"]?: {
          templater?: Templater.ITemplater;
        };
      };
    };
  }
}
