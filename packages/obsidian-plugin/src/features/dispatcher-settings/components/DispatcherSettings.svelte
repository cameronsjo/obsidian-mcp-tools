<script lang="ts">
  import type McpToolsPlugin from "$/main";
  import type {
    DispatcherConfig,
    DeclaredPluginConfig,
  } from "$/types";
  import { onMount } from "svelte";
  import DeclaredPluginEditor from "./DeclaredPluginEditor.svelte";

  export let plugin: McpToolsPlugin;

  // Default configuration
  const defaultConfig: DispatcherConfig = {
    dispatchers: {
      vault: true,
      activeFile: true,
      plugin: true,
      discover: true,
    },
    plugins: {
      autoDetect: true,
      official: {
        "smart-connections": true,
        templater: true,
      },
      declared: [],
    },
    legacy: {
      enabled: true,
      disabled: [],
    },
  };

  let config: DispatcherConfig = { ...defaultConfig };
  let showAddPlugin = false;
  let editingPlugin: DeclaredPluginConfig | null = null;

  onMount(async () => {
    const data = await plugin.loadData();
    if (data?.dispatcher) {
      config = {
        ...defaultConfig,
        ...data.dispatcher,
        dispatchers: { ...defaultConfig.dispatchers, ...data.dispatcher.dispatchers },
        plugins: {
          ...defaultConfig.plugins,
          ...data.dispatcher.plugins,
          official: { ...defaultConfig.plugins.official, ...data.dispatcher.plugins?.official },
          declared: data.dispatcher.plugins?.declared ?? [],
        },
        legacy: { ...defaultConfig.legacy, ...data.dispatcher.legacy },
      };
    }
  });

  async function saveConfig() {
    const data = await plugin.loadData();
    await plugin.saveData({ ...data, dispatcher: config });
  }

  function handleDispatcherToggle(key: keyof typeof config.dispatchers) {
    config.dispatchers[key] = !config.dispatchers[key];
    saveConfig();
  }

  function handleOfficialToggle(key: string) {
    config.plugins.official[key] = !config.plugins.official[key];
    saveConfig();
  }

  function handleAutoDetectToggle() {
    config.plugins.autoDetect = !config.plugins.autoDetect;
    saveConfig();
  }

  function handleLegacyToggle() {
    config.legacy.enabled = !config.legacy.enabled;
    saveConfig();
  }

  function handleAddPlugin() {
    editingPlugin = {
      id: "",
      name: "",
      description: "",
      enabled: true,
      endpoints: {},
    };
    showAddPlugin = true;
  }

  function handleEditPlugin(plugin: DeclaredPluginConfig) {
    editingPlugin = { ...plugin };
    showAddPlugin = true;
  }

  function handleSavePlugin(savedPlugin: DeclaredPluginConfig) {
    const existingIndex = config.plugins.declared.findIndex(
      (p) => p.id === savedPlugin.id
    );

    if (existingIndex >= 0) {
      config.plugins.declared[existingIndex] = savedPlugin;
    } else {
      config.plugins.declared = [...config.plugins.declared, savedPlugin];
    }

    showAddPlugin = false;
    editingPlugin = null;
    saveConfig();
  }

  function handleDeletePlugin(pluginId: string) {
    config.plugins.declared = config.plugins.declared.filter(
      (p) => p.id !== pluginId
    );
    saveConfig();
  }

  function handleToggleDeclaredPlugin(pluginId: string) {
    const plugin = config.plugins.declared.find((p) => p.id === pluginId);
    if (plugin) {
      plugin.enabled = !plugin.enabled;
      config.plugins.declared = [...config.plugins.declared];
      saveConfig();
    }
  }

  function handleCancelEdit() {
    showAddPlugin = false;
    editingPlugin = null;
  }
</script>

<div class="dispatcher-settings">
  <h2>MCP Tool Configuration</h2>
  <p class="setting-description">
    Configure which tools are exposed to Claude and other MCP clients.
    Power to the player!
  </p>

  <!-- Dispatcher Tools Section -->
  <div class="setting-section">
    <h3>Unified Dispatchers</h3>
    <p class="section-description">
      New consolidated tools that reduce context usage by ~70%.
    </p>

    <div class="toggle-group">
      <label class="toggle-item">
        <input
          type="checkbox"
          checked={config.dispatchers.vault}
          on:change={() => handleDispatcherToggle("vault")}
        />
        <span class="toggle-label">
          <strong>vault</strong>
          <span class="toggle-desc">File operations (read, write, delete, move, search...)</span>
        </span>
      </label>

      <label class="toggle-item">
        <input
          type="checkbox"
          checked={config.dispatchers.activeFile}
          on:change={() => handleDispatcherToggle("activeFile")}
        />
        <span class="toggle-label">
          <strong>active_file</strong>
          <span class="toggle-desc">Operations on the currently open file</span>
        </span>
      </label>

      <label class="toggle-item">
        <input
          type="checkbox"
          checked={config.dispatchers.plugin}
          on:change={() => handleDispatcherToggle("plugin")}
        />
        <span class="toggle-label">
          <strong>plugin</strong>
          <span class="toggle-desc">Plugin integrations (Smart Connections, Templater, custom...)</span>
        </span>
      </label>

      <label class="toggle-item">
        <input
          type="checkbox"
          checked={config.dispatchers.discover}
          on:change={() => handleDispatcherToggle("discover")}
        />
        <span class="toggle-label">
          <strong>discover</strong>
          <span class="toggle-desc">Runtime capability discovery for LLMs</span>
        </span>
      </label>
    </div>
  </div>

  <!-- Official Plugins Section -->
  <div class="setting-section">
    <h3>Official Plugin Integrations</h3>
    <p class="section-description">
      Bundled adapters for popular Obsidian plugins.
    </p>

    <div class="toggle-group">
      <label class="toggle-item">
        <input
          type="checkbox"
          checked={config.plugins.official["smart-connections"]}
          on:change={() => handleOfficialToggle("smart-connections")}
        />
        <span class="toggle-label">
          <strong>Smart Connections</strong>
          <span class="toggle-desc">AI-powered semantic search</span>
        </span>
      </label>

      <label class="toggle-item">
        <input
          type="checkbox"
          checked={config.plugins.official["templater"]}
          on:change={() => handleOfficialToggle("templater")}
        />
        <span class="toggle-label">
          <strong>Templater</strong>
          <span class="toggle-desc">Template execution with dynamic content</span>
        </span>
      </label>
    </div>

    <label class="toggle-item standalone">
      <input
        type="checkbox"
        checked={config.plugins.autoDetect}
        on:change={handleAutoDetectToggle}
      />
      <span class="toggle-label">
        <strong>Auto-detect plugins</strong>
        <span class="toggle-desc">Probe APIs to discover additional plugins (Dataview, Tasks...)</span>
      </span>
    </label>
  </div>

  <!-- MCP Proxy / Declared Plugins Section -->
  <div class="setting-section">
    <h3>MCP Proxy (Custom Plugins)</h3>
    <p class="section-description">
      Define your own plugin integrations. Wire up any Obsidian plugin with a REST API!
    </p>

    {#if config.plugins.declared.length > 0}
      <div class="declared-plugins-list">
        {#each config.plugins.declared as declaredPlugin (declaredPlugin.id)}
          <div class="declared-plugin-item">
            <div class="plugin-info">
              <label class="plugin-toggle">
                <input
                  type="checkbox"
                  checked={declaredPlugin.enabled}
                  on:change={() => handleToggleDeclaredPlugin(declaredPlugin.id)}
                />
                <strong>{declaredPlugin.name}</strong>
              </label>
              {#if declaredPlugin.description}
                <span class="plugin-desc">{declaredPlugin.description}</span>
              {/if}
              <span class="plugin-endpoints">
                {Object.keys(declaredPlugin.endpoints).length} endpoint(s)
              </span>
            </div>
            <div class="plugin-actions">
              <button class="mod-warning" on:click={() => handleEditPlugin(declaredPlugin)}>
                Edit
              </button>
              <button class="mod-warning" on:click={() => handleDeletePlugin(declaredPlugin.id)}>
                Delete
              </button>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <p class="empty-state">No custom plugins configured yet.</p>
    {/if}

    <button class="mod-cta" on:click={handleAddPlugin}>
      + Add Custom Plugin
    </button>
  </div>

  <!-- Legacy Tools Section -->
  <div class="setting-section">
    <h3>Legacy Tools</h3>
    <p class="section-description">
      Keep individual tools available for backward compatibility.
    </p>

    <label class="toggle-item standalone">
      <input
        type="checkbox"
        checked={config.legacy.enabled}
        on:change={handleLegacyToggle}
      />
      <span class="toggle-label">
        <strong>Enable legacy tools</strong>
        <span class="toggle-desc">Keep all 21+ individual tools available alongside dispatchers</span>
      </span>
    </label>
  </div>
</div>

<!-- Plugin Editor Modal -->
{#if showAddPlugin && editingPlugin}
  <DeclaredPluginEditor
    plugin={editingPlugin}
    onSave={handleSavePlugin}
    onCancel={handleCancelEdit}
  />
{/if}

<style>
  .dispatcher-settings {
    padding: 1em 0;
  }

  .dispatcher-settings h2 {
    margin-top: 0;
    margin-bottom: 0.5em;
  }

  .setting-description {
    color: var(--text-muted);
    margin-bottom: 1.5em;
  }

  .setting-section {
    margin-bottom: 2em;
    padding: 1em;
    background: var(--background-secondary);
    border-radius: 8px;
  }

  .setting-section h3 {
    margin-top: 0;
    margin-bottom: 0.25em;
  }

  .section-description {
    color: var(--text-muted);
    font-size: 0.9em;
    margin-bottom: 1em;
  }

  .toggle-group {
    display: flex;
    flex-direction: column;
    gap: 0.5em;
  }

  .toggle-item {
    display: flex;
    align-items: flex-start;
    gap: 0.75em;
    padding: 0.5em;
    border-radius: 4px;
    cursor: pointer;
  }

  .toggle-item:hover {
    background: var(--background-modifier-hover);
  }

  .toggle-item.standalone {
    margin-top: 1em;
  }

  .toggle-item input[type="checkbox"] {
    margin-top: 0.25em;
  }

  .toggle-label {
    display: flex;
    flex-direction: column;
  }

  .toggle-desc {
    font-size: 0.85em;
    color: var(--text-muted);
  }

  .declared-plugins-list {
    display: flex;
    flex-direction: column;
    gap: 0.5em;
    margin-bottom: 1em;
  }

  .declared-plugin-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75em;
    background: var(--background-primary);
    border-radius: 4px;
    border: 1px solid var(--background-modifier-border);
  }

  .plugin-info {
    display: flex;
    flex-direction: column;
    gap: 0.25em;
  }

  .plugin-toggle {
    display: flex;
    align-items: center;
    gap: 0.5em;
    cursor: pointer;
  }

  .plugin-desc {
    font-size: 0.85em;
    color: var(--text-muted);
  }

  .plugin-endpoints {
    font-size: 0.8em;
    color: var(--text-faint);
  }

  .plugin-actions {
    display: flex;
    gap: 0.5em;
  }

  .empty-state {
    color: var(--text-muted);
    font-style: italic;
    margin: 1em 0;
  }

  button {
    cursor: pointer;
  }

  button.mod-cta {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    padding: 0.5em 1em;
    border-radius: 4px;
    font-weight: 500;
  }

  button.mod-cta:hover {
    background: var(--interactive-accent-hover);
  }

  button.mod-warning {
    background: transparent;
    border: 1px solid var(--background-modifier-border);
    padding: 0.25em 0.75em;
    border-radius: 4px;
    font-size: 0.85em;
  }

  button.mod-warning:hover {
    background: var(--background-modifier-hover);
  }
</style>
