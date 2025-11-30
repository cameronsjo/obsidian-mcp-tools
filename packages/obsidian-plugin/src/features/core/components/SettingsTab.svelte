<script lang="ts">
  import { FeatureSettings as McpServerInstallSettings } from "src/features/mcp-server-install";
  import { FeatureSettings as DispatcherSettings } from "src/features/dispatcher-settings";
  import type McpServerPlugin from "src/main";

  export let plugin: McpServerPlugin;
</script>

<div class="settings-container">
  <McpServerInstallSettings {plugin} />

  <hr class="settings-divider" />

  <DispatcherSettings {plugin} />
</div>

<style>
  .settings-divider {
    margin: 2em 0;
    border: none;
    border-top: 1px solid var(--background-modifier-border);
  }
</style>
