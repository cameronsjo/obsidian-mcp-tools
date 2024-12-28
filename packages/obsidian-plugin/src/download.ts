import fs from "fs";
import fsp from "fs/promises";
import https from "https";
import os from "os";
import path from "path";
import { Observable } from "rxjs";
import { logger } from "./logger";

export type Platform = "linux" | "mac" | "windows";
export type Architecture = "x64" | "arm64";

export interface DownloadProgress {
	downloadedBytes: number;
	totalBytes: number;
	percentage: number;
}

export function getPlatform(): Platform {
	const platform = os.platform();
	switch (platform) {
		case "darwin":
			return "mac";
		case "win32":
			return "windows";
		default:
			return "linux";
	}
}

export function getArch(): Architecture {
	return os.arch() as Architecture;
}

export function getDownloadUrl(platform: Platform, arch: Architecture): string {
	const base =
		"https://github.com/jacksteamdev/obsidian-mcp-tools/releases/latest/download";

	switch (platform) {
		case "windows":
			return `${base}/mcp-server-windows.exe`;
		case "mac":
			return `${base}/mcp-server-mac-${arch}`;
		case "linux":
			return `${base}/mcp-server-linux`;
	}
}

/**
 * Generates the output path for the MCP server based on the platform.
 *
 * @param platform - The platform for which the output path should be generated.
 * @param dirname - The directory name where the output path should be resolved.
 * @returns The resolved output path for the MCP server.
 */
export function getOutputPath(platform: Platform, dirname: string): string {
	const filename = platform === "windows" ? "mcp-server.exe" : "mcp-server";
	const outputPath = path.resolve(__dirname, "../bin", filename);
	return outputPath;
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
			let skipCount = 1;  // Skip first segment by default

			// Handle the root segment differently for Windows vs POSIX
			if (path.win32.isAbsolute(filepath)) {
				resolvedParts.push(parts[0]);
				if (parts[1] === '') {
					resolvedParts.push('');
					skipCount = 2;  // Skip two segments for UNC paths
				}
			} else if (path.posix.isAbsolute(filepath)) {
				resolvedParts.push('/');
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

/**
 * Ensures that the specified directory path exists and is writable.
 *
 * If the directory does not exist, it will be created recursively. If the directory
 * exists but is not writable, an error will be thrown.
 *
 * @param dirpath - The directory path to ensure exists and is writable.
 * @throws {Error} If the directory does not exist or is not writable.
 */
export async function ensureDirectory(dirpath: string) {
	try {
		const resolvedPath = await resolveSymlinks(dirpath);
		if (!fs.existsSync(resolvedPath)) {
			await fsp.mkdir(resolvedPath, { recursive: true });
		}

		// Verify directory was created and is writable
		try {
			await fsp.access(resolvedPath, fs.constants.W_OK);
		} catch (accessError) {
			throw new Error(
				`Directory exists but is not writable: ${resolvedPath}`,
			);
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

		const cleanup = () => {
			fileStream?.destroy();
			fs.unlink(outputPath, () => {});
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
						downloadFile(
							redirectUrl,
							outputPath,
							redirects + 1,
						).subscribe(subscriber);
						return;
					}

					if (statusCode !== 200) {
						throw new Error(
							`Unexpected status code: ${statusCode}`,
						);
					}

					// Validate content length
					const contentLength = response.headers["content-length"];
					const totalBytes = contentLength
						? parseInt(contentLength, 10)
						: 0;
					if (contentLength && isNaN(totalBytes)) {
						throw new Error("Invalid content-length header");
					}

					try {
						fileStream = fs.createWriteStream(outputPath, {
							mode: 0o644,
							flags: "w",
						});
					} catch (err) {
						throw new Error(
							`Failed to create write stream: ${err instanceof Error ? err.message : String(err)}`,
						);
					}

					let downloadedBytes = 0;

					fileStream.on("error", (err) => {
						cleanup();
						subscriber.error(
							new Error(`File stream error: ${err.message}`),
						);
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
								downloadedBytes,
								totalBytes,
								percentage: Math.round(percentage * 100) / 100,
							});
						} catch (err) {
							cleanup();
							subscriber.error(err);
						}
					});

					response.pipe(fileStream);

					fileStream.on("finish", () => {
						fileStream?.close();
						subscriber.complete();
					});

					response.on("error", (err) => {
						cleanup();
						subscriber.error(
							new Error(`Response error: ${err.message}`),
						);
					});
				} catch (err) {
					cleanup();
					subscriber.error(
						err instanceof Error ? err : new Error(String(err)),
					);
				}
			})
			.on("error", (err) => {
				cleanup();
				subscriber.error(new Error(`Network error: ${err.message}`));
			});

		return () => {
			cleanup(); // Cleanup on unsubscribe
		};
	});
}
