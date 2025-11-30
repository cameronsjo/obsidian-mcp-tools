import crypto from "crypto";
import fs from "fs";
import fsp from "fs/promises";
import https from "https";
import { Notice, Plugin } from "obsidian";
import os from "os";
import { Observable } from "rxjs";
import { logger } from "$/shared";
import { GITHUB_DOWNLOAD_URL, type Arch, type Platform } from "../constants";
import type { DownloadProgress, InstallPathInfo } from "../types";
import { getInstallPath } from "./status";

export function getPlatform(): Platform {
  const platform = os.platform();
  switch (platform) {
    case "darwin":
      return "macos";
    case "win32":
      return "windows";
    default:
      return "linux";
  }
}

export function getArch(): Arch {
  return os.arch() as Arch;
}

export function getDownloadUrl(platform: Platform, arch: Arch): string {
  if (platform === "windows") {
    return `${GITHUB_DOWNLOAD_URL}/mcp-server-windows.exe`;
  } else if (platform === "macos") {
    return `${GITHUB_DOWNLOAD_URL}/mcp-server-macos-${arch}`;
  } else { // linux
    return `${GITHUB_DOWNLOAD_URL}/mcp-server-linux`;  // Linux binary doesn't include arch in filename
  }
}

export function getBinaryFilename(platform: Platform, arch: Arch): string {
  if (platform === "windows") {
    return "mcp-server-windows.exe";
  } else if (platform === "macos") {
    return `mcp-server-macos-${arch}`;
  } else {
    return "mcp-server-linux";
  }
}

export function getChecksumsUrl(): string {
  return `${GITHUB_DOWNLOAD_URL}/checksums.txt`;
}

/**
 * Downloads the checksums file and parses it into a map of filename -> hash
 */
export async function fetchChecksums(): Promise<Map<string, string>> {
  const url = getChecksumsUrl();

  return new Promise((resolve, reject) => {
    const fetchWithRedirects = (fetchUrl: string, redirects = 0) => {
      if (redirects > 5) {
        reject(new Error("Too many redirects while fetching checksums"));
        return;
      }

      https.get(fetchUrl, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (!redirectUrl) {
            reject(new Error("Redirect without location header"));
            return;
          }
          fetchWithRedirects(redirectUrl, redirects + 1);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to fetch checksums: HTTP ${response.statusCode}`));
          return;
        }

        let data = "";
        response.on("data", (chunk) => { data += chunk; });
        response.on("end", () => {
          const checksums = new Map<string, string>();
          const lines = data.trim().split("\n");

          for (const line of lines) {
            // Format: "hash  filename" (two spaces between hash and filename)
            const match = line.match(/^([a-f0-9]{64})\s+(.+)$/);
            if (match) {
              checksums.set(match[2], match[1]);
            }
          }

          if (checksums.size === 0) {
            reject(new Error("No valid checksums found in checksums.txt"));
            return;
          }

          resolve(checksums);
        });
        response.on("error", reject);
      }).on("error", reject);
    };

    fetchWithRedirects(url);
  });
}

/**
 * Calculates the SHA-256 hash of a file
 */
export async function calculateFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);

    stream.on("data", (data) => hash.update(data));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

/**
 * Verifies the integrity of a downloaded binary against the expected checksum
 */
export async function verifyBinaryIntegrity(
  filePath: string,
  expectedHash: string,
): Promise<boolean> {
  const actualHash = await calculateFileHash(filePath);
  const matches = actualHash.toLowerCase() === expectedHash.toLowerCase();

  if (!matches) {
    logger.error("Binary integrity check failed", {
      expected: expectedHash,
      actual: actualHash,
      filePath,
    });
  }

  return matches;
}

/**
 * Ensures that the specified directory path exists and is writable.
 *
 * If the directory does not exist, it will be created recursively. If the directory
 * exists but is not writable, an error will be thrown.
 *
 * @param dirpath - The real directory path to ensure exists and is writable.
 * @throws {Error} If the directory does not exist or is not writable.
 */
export async function ensureDirectory(dirpath: string) {
  try {
    if (!fs.existsSync(dirpath)) {
      await fsp.mkdir(dirpath, { recursive: true });
    }

    // Verify directory was created and is writable
    try {
      await fsp.access(dirpath, fs.constants.W_OK);
    } catch (accessError) {
      throw new Error(`Directory exists but is not writable: ${dirpath}`);
    }
  } catch (error) {
    logger.error(`Failed to ensure directory:`, { error });
    throw error;
  }
}

export function downloadFile(
  url: string,
  outputPath: string,
  redirects = 0,
): Observable<DownloadProgress> {
  return new Observable((subscriber) => {
    if (redirects > 5) {
      subscriber.error(new Error("Too many redirects"));
      return;
    }

    let fileStream: fs.WriteStream | undefined;
    const cleanup = (err?: unknown) => {
      if (err) {
        logger.debug("Cleaning up incomplete download:", {
          outputPath,
          writableFinished: JSON.stringify(fileStream?.writableFinished),
          error: err instanceof Error ? err.message : String(err),
        });
        fileStream?.destroy();
        fsp.unlink(outputPath).catch((unlinkError) => {
          logger.error("Failed to clean up incomplete download:", {
            outputPath,
            error:
              unlinkError instanceof Error
                ? unlinkError.message
                : String(unlinkError),
          });
        });
      } else {
        fileStream?.close();
        fsp.chmod(outputPath, 0o755).catch((chmodError) => {
          logger.error("Failed to set executable permissions:", {
            outputPath,
            error:
              chmodError instanceof Error
                ? chmodError.message
                : String(chmodError),
          });
        });
      }
    };

    https
      .get(url, (response) => {
        try {
          if (!response) {
            throw new Error("No response received");
          }

          const statusCode = response.statusCode ?? 0;

          // Handle various HTTP status codes
          if (statusCode >= 400) {
            throw new Error(
              `HTTP Error ${statusCode}: ${response.statusMessage}`,
            );
          }

          if (statusCode === 302 || statusCode === 301) {
            const redirectUrl = response.headers.location;
            if (!redirectUrl) {
              throw new Error(
                `Redirect (${statusCode}) received but no location header found`,
              );
            }

            // Handle redirect by creating a new observable
            downloadFile(redirectUrl, outputPath, redirects + 1).subscribe(
              subscriber,
            );
            return;
          }

          if (statusCode !== 200) {
            throw new Error(`Unexpected status code: ${statusCode}`);
          }

          // Validate content length
          const contentLength = response.headers["content-length"];
          const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
          if (contentLength && isNaN(totalBytes)) {
            throw new Error("Invalid content-length header");
          }

          try {
            fileStream = fs.createWriteStream(outputPath, {
              flags: "w",
            });
          } catch (err) {
            throw new Error(
              `Failed to create write stream: ${err instanceof Error ? err.message : String(err)}`,
            );
          }

          let downloadedBytes = 0;

          fileStream.on("error", (err) => {
            const fileStreamError = new Error(
              `File stream error: ${err.message}`,
            );
            cleanup(fileStreamError);
            subscriber.error(fileStreamError);
          });

          response.on("data", (chunk: Buffer) => {
            try {
              if (!Buffer.isBuffer(chunk)) {
                throw new Error("Received invalid data chunk");
              }

              downloadedBytes += chunk.length;
              const percentage = totalBytes
                ? (downloadedBytes / totalBytes) * 100
                : 0;

              subscriber.next({
                bytesReceived: downloadedBytes,
                totalBytes,
                percentage: Math.round(percentage * 100) / 100,
              });
            } catch (err) {
              cleanup(err);
              subscriber.error(err);
            }
          });

          response.pipe(fileStream);

          fileStream.on("finish", () => {
            cleanup();
            subscriber.complete();
          });

          response.on("error", (err) => {
            cleanup(err);
            subscriber.error(new Error(`Response error: ${err.message}`));
          });
        } catch (err) {
          cleanup(err);
          subscriber.error(err instanceof Error ? err : new Error(String(err)));
        }
      })
      .on("error", (err) => {
        cleanup(err);
        subscriber.error(new Error(`Network error: ${err.message}`));
      });
  });
}

export async function installMcpServer(
  plugin: Plugin,
): Promise<InstallPathInfo> {
  try {
    const platform = getPlatform();
    const arch = getArch();
    const downloadUrl = getDownloadUrl(platform, arch);
    const binaryFilename = getBinaryFilename(platform, arch);
    const installPath = await getInstallPath(plugin);
    if ("error" in installPath) throw new Error(installPath.error);

    await ensureDirectory(installPath.dir);

    // Fetch checksums first
    const progressNotice = new Notice("Fetching checksums...", 0);
    let checksums: Map<string, string>;
    try {
      checksums = await fetchChecksums();
      logger.debug("Fetched checksums", { count: checksums.size });
    } catch (error) {
      // Log warning but continue - checksums might not exist for older releases
      logger.warn("Could not fetch checksums, skipping integrity verification", {
        error: error instanceof Error ? error.message : String(error),
      });
      checksums = new Map();
    }

    progressNotice.setMessage("Downloading MCP server...");
    logger.debug("Downloading MCP server:", { downloadUrl, installPath });

    const download$ = downloadFile(downloadUrl, installPath.path);

    return new Promise((resolve, reject) => {
      download$.subscribe({
        next: (progress: DownloadProgress) => {
          progressNotice.setMessage(
            `Downloading MCP server: ${progress.percentage}%`,
          );
        },
        error: (error: Error) => {
          progressNotice.hide();
          new Notice(`Failed to download MCP server: ${error.message}`);
          logger.error("Download failed:", { error, installPath });
          reject(error);
        },
        complete: async () => {
          try {
            // Verify binary integrity if checksum is available
            const expectedHash = checksums.get(binaryFilename);
            if (expectedHash) {
              progressNotice.setMessage("Verifying binary integrity...");
              const isValid = await verifyBinaryIntegrity(installPath.path, expectedHash);

              if (!isValid) {
                // Delete the corrupted/tampered binary
                await fsp.unlink(installPath.path).catch(() => {});
                progressNotice.hide();
                const error = new Error(
                  "Binary integrity verification failed. The download may be corrupted or tampered with.",
                );
                new Notice(error.message, 0);
                logger.error("Binary integrity verification failed", {
                  binaryFilename,
                  installPath: installPath.path,
                });
                reject(error);
                return;
              }

              logger.info("Binary integrity verified", { binaryFilename });
            } else {
              logger.warn("No checksum available for binary, skipping verification", {
                binaryFilename,
              });
            }

            progressNotice.hide();
            new Notice("MCP server downloaded successfully!");
            logger.info("MCP server downloaded", { installPath });
            resolve(installPath);
          } catch (error) {
            progressNotice.hide();
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        },
      });
    });
  } catch (error) {
    new Notice(
      `Failed to install MCP server: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
}
