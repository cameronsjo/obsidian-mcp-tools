<script lang="ts">
  import type { DeclaredPluginConfig, DeclaredPluginEndpoint } from "$/types";

  export let plugin: DeclaredPluginConfig;
  export let onSave: (plugin: DeclaredPluginConfig) => void;
  export let onCancel: () => void;

  // Local state for editing
  let id = plugin.id;
  let name = plugin.name;
  let description = plugin.description || "";
  let enabled = plugin.enabled;
  let endpoints: Array<{ name: string; config: DeclaredPluginEndpoint }> =
    Object.entries(plugin.endpoints).map(([name, config]) => ({ name, config }));

  let newEndpointName = "";
  let error = "";

  function addEndpoint() {
    if (!newEndpointName.trim()) {
      error = "Endpoint name is required";
      return;
    }

    if (endpoints.some(e => e.name === newEndpointName)) {
      error = "Endpoint name already exists";
      return;
    }

    endpoints = [
      ...endpoints,
      {
        name: newEndpointName.trim(),
        config: {
          method: "POST",
          path: "/",
          description: "",
          parameters: {},
        },
      },
    ];
    newEndpointName = "";
    error = "";
  }

  function removeEndpoint(index: number) {
    endpoints = endpoints.filter((_, i) => i !== index);
  }

  function handleSave() {
    // Validate
    if (!id.trim()) {
      error = "Plugin ID is required";
      return;
    }

    if (!name.trim()) {
      error = "Plugin name is required";
      return;
    }

    if (endpoints.length === 0) {
      error = "At least one endpoint is required";
      return;
    }

    // Convert endpoints array back to object
    const endpointsObj: Record<string, DeclaredPluginEndpoint> = {};
    for (const ep of endpoints) {
      endpointsObj[ep.name] = ep.config;
    }

    onSave({
      id: id.trim(),
      name: name.trim(),
      description: description.trim() || undefined,
      enabled,
      endpoints: endpointsObj,
    });
  }

  function generateIdFromName() {
    if (!id && name) {
      id = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    }
  }
</script>

<div class="modal-overlay" on:click={onCancel} role="dialog" aria-modal="true">
  <div class="modal-content" on:click|stopPropagation role="document">
    <h2>{plugin.id ? "Edit" : "Add"} Custom Plugin</h2>

    {#if error}
      <div class="error-message">{error}</div>
    {/if}

    <div class="form-group">
      <label for="plugin-name">Plugin Name</label>
      <input
        id="plugin-name"
        type="text"
        bind:value={name}
        on:blur={generateIdFromName}
        placeholder="My Awesome Plugin"
      />
    </div>

    <div class="form-group">
      <label for="plugin-id">Plugin ID</label>
      <input
        id="plugin-id"
        type="text"
        bind:value={id}
        placeholder="my-awesome-plugin"
        disabled={!!plugin.id}
      />
      <span class="form-hint">Unique identifier (auto-generated from name)</span>
    </div>

    <div class="form-group">
      <label for="plugin-description">Description</label>
      <input
        id="plugin-description"
        type="text"
        bind:value={description}
        placeholder="What does this plugin do?"
      />
    </div>

    <div class="endpoints-section">
      <h3>Endpoints</h3>
      <p class="section-hint">
        Define API endpoints that Claude can call. Map them to your plugin's REST API.
      </p>

      {#each endpoints as endpoint, index (endpoint.name)}
        <div class="endpoint-card">
          <div class="endpoint-header">
            <strong>{endpoint.name}</strong>
            <button class="remove-btn" on:click={() => removeEndpoint(index)}>
              Remove
            </button>
          </div>

          <div class="endpoint-form">
            <div class="form-row">
              <div class="form-group small">
                <label>Method</label>
                <select bind:value={endpoint.config.method}>
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                  <option value="PATCH">PATCH</option>
                </select>
              </div>

              <div class="form-group flex-grow">
                <label>Path</label>
                <input
                  type="text"
                  bind:value={endpoint.config.path}
                  placeholder="/plugins/my-plugin/action"
                />
              </div>
            </div>

            <div class="form-group">
              <label>Description</label>
              <input
                type="text"
                bind:value={endpoint.config.description}
                placeholder="What does this endpoint do?"
              />
            </div>
          </div>
        </div>
      {/each}

      <div class="add-endpoint">
        <input
          type="text"
          bind:value={newEndpointName}
          placeholder="Endpoint name (e.g., search, execute)"
          on:keydown={(e) => e.key === "Enter" && addEndpoint()}
        />
        <button on:click={addEndpoint}>+ Add Endpoint</button>
      </div>
    </div>

    <div class="modal-actions">
      <button class="mod-muted" on:click={onCancel}>Cancel</button>
      <button class="mod-cta" on:click={handleSave}>Save Plugin</button>
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background: var(--background-primary);
    border-radius: 8px;
    padding: 1.5em;
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }

  .modal-content h2 {
    margin-top: 0;
    margin-bottom: 1em;
  }

  .error-message {
    color: var(--text-error);
    background: var(--background-modifier-error);
    padding: 0.75em 1em;
    border-radius: 4px;
    margin-bottom: 1em;
  }

  .form-group {
    margin-bottom: 1em;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.25em;
    font-weight: 500;
  }

  .form-group input,
  .form-group select {
    width: 100%;
    padding: 0.5em;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
  }

  .form-group input:focus,
  .form-group select:focus {
    border-color: var(--interactive-accent);
    outline: none;
  }

  .form-group input:disabled {
    background: var(--background-secondary);
    color: var(--text-muted);
  }

  .form-hint {
    font-size: 0.8em;
    color: var(--text-muted);
    margin-top: 0.25em;
    display: block;
  }

  .form-row {
    display: flex;
    gap: 1em;
  }

  .form-group.small {
    flex: 0 0 120px;
  }

  .form-group.flex-grow {
    flex: 1;
  }

  .endpoints-section {
    margin-top: 1.5em;
    padding-top: 1em;
    border-top: 1px solid var(--background-modifier-border);
  }

  .endpoints-section h3 {
    margin-top: 0;
    margin-bottom: 0.25em;
  }

  .section-hint {
    color: var(--text-muted);
    font-size: 0.9em;
    margin-bottom: 1em;
  }

  .endpoint-card {
    background: var(--background-secondary);
    border-radius: 6px;
    padding: 1em;
    margin-bottom: 1em;
  }

  .endpoint-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75em;
  }

  .endpoint-form .form-group {
    margin-bottom: 0.75em;
  }

  .endpoint-form .form-group:last-child {
    margin-bottom: 0;
  }

  .remove-btn {
    background: transparent;
    border: none;
    color: var(--text-error);
    cursor: pointer;
    font-size: 0.85em;
  }

  .remove-btn:hover {
    text-decoration: underline;
  }

  .add-endpoint {
    display: flex;
    gap: 0.5em;
  }

  .add-endpoint input {
    flex: 1;
    padding: 0.5em;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
  }

  .add-endpoint button {
    padding: 0.5em 1em;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    cursor: pointer;
    white-space: nowrap;
  }

  .add-endpoint button:hover {
    background: var(--background-modifier-hover);
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75em;
    margin-top: 1.5em;
    padding-top: 1em;
    border-top: 1px solid var(--background-modifier-border);
  }

  .modal-actions button {
    padding: 0.5em 1.5em;
    border-radius: 4px;
    cursor: pointer;
  }

  .modal-actions button.mod-muted {
    background: transparent;
    border: 1px solid var(--background-modifier-border);
  }

  .modal-actions button.mod-cta {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    font-weight: 500;
  }

  .modal-actions button.mod-cta:hover {
    background: var(--interactive-accent-hover);
  }
</style>
