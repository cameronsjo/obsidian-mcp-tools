<script lang="ts">
  import { unlink } from "node:fs/promises";
  import { normalizePath } from "obsidian";
  import { getLogDirectory } from "shared";
  import type McpToolsPlugin from "src/main";
  import { loadDependencies } from "src/shared";
  import { onMount } from "svelte";
  import { BINARY_NAME } from "../constants";
  import { getPlatform, installMcpServer } from "../services/download";
  import { getInstallationStatus } from "../services/status";
  import type { InstallationStatus } from "../types";
  import { openFolder } from "../utils/openFolder";

  export let plugin: McpToolsPlugin;

  // Dependencies
  const dependencyStore = loadDependencies(plugin);
  let deps = $dependencyStore;

  // Installation status
  let status: InstallationStatus = {
    isInstalled: false,
    isInstalling: false,
  };
  onMount(async () => {
    status = await getInstallationStatus(plugin);
  });

  // Handle installation
  async function handleInstall() {
    try {
      status = { isInstalled: false, isInstalling: true };
      await installMcpServer(plugin);
      status = await getInstallationStatus(plugin);
    } catch (error) {
      status = {
        isInstalled: false,
        isInstalling: false,
      };
    }
  }

  // Handle uninstall
  async function handleUninstall() {
    try {
      status = { isInstalled: false, isInstalling: true };
      // For now, we'll just remove the binary file
      const platform = getPlatform();
      // TODO: normalizePath omits the starting slash for POSIX, IDK what it does to Windows paths
      const binPath = normalizePath(
        `${plugin.app.vault.adapter.basePath}/${plugin.app.vault.configDir}/plugins/${plugin.manifest.id}/bin/${BINARY_NAME[platform]}`,
      );
      await unlink(binPath);
      status = { isInstalled: false };
      // TODO: Remove our app from claude_desktop_config.json
    } catch (error) {
      status = {
        isInstalled: true,
        isInstalling: false,
      };
    }
  }
</script>

<div class="installation-status">
  <h3>Installation Status</h3>

  {#if !status.isInstalled && !status.isInstalling}
    <div class="status-message">
      MCP Server is not installed
      <button on:click={handleInstall}>Install</button>
    </div>
  {:else if status.isInstalling}
    <div class="status-message">Installing MCP Server...</div>
  {:else if status.isInstalled && !status.updateAvailable}
    <div class="status-message">
      MCP Server v{status.version} is installed
      <button on:click={handleUninstall}>Uninstall</button>
    </div>
  {:else if status.isInstalled && status.updateAvailable}
    <div class="status-message">
      Update available (v{status.version})
      <button on:click={handleInstall}>Update</button>
    </div>
  {/if}
</div>

<div class="dependencies">
  <h3>Dependencies</h3>

  {#each Object.entries(deps) as [id, dep] (id)}
    <div class="dependency-item">
      <span class={dep.installed ? "installed" : "not-installed"}>
        {dep.name}
        {dep.required ? "(Required)" : "(Optional)"}
      </span>
      {#if !dep.installed && dep.url}
        <a href={dep.url} target="_blank">Install</a>
      {/if}
    </div>
  {/each}
</div>

<div class="links">
  <h3>Resources</h3>

  {#if status.path}
    <div class="link-item">
      <button on:click={() => status.dir && openFolder(status.dir)}>
        Open Server Install Folder
      </button>
    </div>
  {/if}

  <div class="link-item">
    <button on:click={() => openFolder(getLogDirectory(plugin.manifest.id))}>
      Open Log Folder
    </button>
  </div>

  <div class="link-item">
    <a
      href="https://github.com/jacksteamdev/obsidian-mcp-tools"
      target="_blank"
    >
      GitHub Repository
    </a>
  </div>
</div>

<style>
  .error-message {
    color: var(--text-error);
    margin-bottom: 1em;
  }

  .status-message {
    margin-bottom: 1em;
  }

  .dependency-item {
    margin-bottom: 0.5em;
  }

  .installed {
    color: var(--text-success);
  }

  .not-installed {
    color: var(--text-muted);
  }

  .link-item {
    margin-bottom: 0.5em;
  }

  button {
    margin-left: 0.5em;
  }
</style>
