import {
	App,
	ButtonComponent,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";
import os from "os";
import path from "path";
import { logger } from "../../../logger";
import { InstallationStatus } from "../types";
import { installMcpServer } from "../services/download";
import { updateClaudeConfig } from "../services/config";
import { LOG_PATH } from "../constants";
import { uninstallServer } from "../services/uninstall";
import {
	getInstallationStatus,
	isClaudeDesktopInstalled,
	isLocalRestApiConfigured,
} from "../services/status";
import { openFolder } from "../utils/openFolder";

export class McpServerSettingsTab extends PluginSettingTab {
	private status: InstallationStatus = { isInstalled: false };
	constructor(
		app: App,
		private plugin: Plugin,
	) {
		super(app, plugin);
	}

	async display(): Promise<void> {
		// Check prerequisites and status
		const hasClaudeDesktop = await isClaudeDesktopInstalled();
		const hasLocalRestApi = isLocalRestApiConfigured(this.plugin);
		this.status = await getInstallationStatus(this.plugin);

		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "MCP Server Settings" });

		// Prerequisites Notice
		if (!hasClaudeDesktop || !hasLocalRestApi) {
			const prereqsEl = containerEl.createEl("div", {
				cls: "mcp-prereqs",
			});
			prereqsEl.createEl("h3", { text: "Required Dependencies" });

			if (!hasClaudeDesktop) {
				const claudeEl = prereqsEl.createEl("p");
				claudeEl.innerHTML =
					'Claude Desktop is required. <a href="https://claude.ai/desktop">Download here</a>.';
			}

			if (!hasLocalRestApi) {
				const restApiEl = prereqsEl.createEl("p");
				restApiEl.innerHTML =
					'Local REST API plugin is required. <a href="https://github.com/coddingtonbear/obsidian-local-rest-api">Install from here</a>.';
			}
		}

		// Installation Status
		const statusEl = containerEl.createEl("div", { cls: "mcp-status" });
		statusEl.createEl("h3", { text: "Installation Status" });

		const statusText = statusEl.createEl("p");
		statusText.setText(this.getStatusText());

		if (this.status.path) {
			new Setting(statusEl)
				.setName("Executable Location")
				.setDesc("Path to the MCP server binary")
				.addButton((button) =>
					button.setButtonText("Open Folder").onClick(() => {
						if (this.status.path) {
							openFolder(path.dirname(this.status.path));
						}
					}),
				);
		}

		// Installation Actions
		const actionsEl = containerEl.createEl("div", { cls: "mcp-actions" });

		// Install/Update Button
		new ButtonComponent(actionsEl)
			.setButtonText(
				this.status.isInstalled
					? this.status.updateAvailable
						? "Update Server"
						: "Reinstall Server"
					: "Install Server",
			)
			.onClick(async () => {
				try {
					this.status.isInstalling = true;
					this.display(); // Refresh to show installing state

					await installMcpServer(this.plugin);

					// Get server path
					const binDir = `${this.plugin.app.vault.adapter.basePath}/${this.plugin.app.vault.configDir}/plugins/${this.plugin.manifest.id}/bin`;
					const serverPath = `${binDir}/mcp-server`;

					// Get API key from Local REST API plugin
					const apiKey =
						this.plugin.app.plugins.plugins[
							"obsidian-local-rest-api"
						]?.settings?.apiKey;
					if (!apiKey) {
						throw new Error(
							"Local REST API plugin API key not found. Please configure the plugin first.",
						);
					}

					await updateClaudeConfig(this.plugin, serverPath, apiKey);

					new Notice(
						"MCP server installed and configured successfully!",
					);
					this.status.isInstalling = false;
					this.display(); // Refresh settings
				} catch (error) {
					logger.error("Installation failed:", { error });
					new Notice(
						`Installation failed: ${error instanceof Error ? error.message : String(error)}`,
					);
					this.status.isInstalling = false;
					this.display();
				}
			});

		if (this.status.isInstalled) {
			// Uninstall Button
			new ButtonComponent(actionsEl)
				.setButtonText("Uninstall Server")
				.setWarning()
				.onClick(async () => {
					try {
						await uninstallServer(this.plugin);
						new Notice("MCP server uninstalled successfully");
						this.display(); // Refresh settings
					} catch (error) {
						logger.error("Uninstall failed:", { error });
						new Notice(
							`Uninstall failed: ${error instanceof Error ? error.message : String(error)}`,
						);
					}
				});
		}

		// Links Section
		const linksEl = containerEl.createEl("div", { cls: "mcp-links" });
		linksEl.createEl("h3", { text: "Resources" });

		// Log Location
		new Setting(linksEl)
			.setName("Log Location")
			.setDesc("View server logs for troubleshooting")
			.addButton((button) =>
				button.setButtonText("Open Logs").onClick(() => {
					const platform = process.platform;
					let logPath: string = LOG_PATH.linux;

					if (platform === "darwin") {
						logPath = LOG_PATH.macos;
					} else if (platform === "win32") {
						logPath = LOG_PATH.windows;
					}

					// Expand home directory
					if (logPath.startsWith("~")) {
						logPath = logPath.replace("~", os.homedir());
					}

					// Expand environment variables on Windows
					if (platform === "win32") {
						logPath = logPath.replace(
							/%([^%]+)%/g,
							(_, n) => process.env[n] || "",
						);
					}

					openFolder(logPath);
				}),
			);

		// External Links
		new Setting(linksEl)
			.setName("Documentation")
			.setDesc("View documentation and source code")
			.addButton((button) =>
				button.setButtonText("GitHub").onClick(() => {
					window.open(
						"https://github.com/jacksteamdev/obsidian-mcp-tools",
					);
				}),
			);
	}

	private getStatusText(): string {
		if (this.status.isInstalling) {
			return "Installing...";
		}

		if (!this.status.isInstalled) {
			return "Not installed";
		}

		let text = `Installed`;
		if (this.status.version) {
			text += ` (version ${this.status.version})`;
		}
		if (this.status.updateAvailable) {
			text += " - Update Available";
		}

		return text;
	}
}
