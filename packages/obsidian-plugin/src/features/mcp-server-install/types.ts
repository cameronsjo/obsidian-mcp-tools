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
  updateAvailable?: boolean;
  isInstalling?: boolean;
}

// Augment Obsidian's App type to include plugins
declare module "obsidian" {
  interface App {
    plugins: {
      plugins: {
        [key: string]: {
          settings?: {
            apiKey?: string;
          };
        };
      };
    };
  }
}
