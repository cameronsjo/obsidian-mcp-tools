import { symlinkSync, existsSync, mkdirSync } from "fs";
import { join, resolve } from "node:path";

/**
 * This development script creates a symlink to the plugin in the Obsidian vault's plugin directory. This allows you to
 * develop the plugin in the repository and see the changes in Obsidian without having to manually copy the files.
 *
 * This function is not included in the plugin itself. It is only used to set up local development.
 *
 * Usage: `bun scripts/link.ts <path_to_obsidian_vault>`
 * @returns {Promise<void>}
 */
async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error(
      "Usage: bun scripts/link.ts <path_to_obsidian_vault_config_folder>",
    );
    process.exit(1);
  }

  const vaultConfigPath = args[0];
  const projectRootDirectory = resolve(__dirname, "../../..");
  const pluginManifestPath = resolve(projectRootDirectory, "manifest.json");
  const pluginsDirectoryPath = join(vaultConfigPath, "plugins");

  const file = Bun.file(pluginManifestPath);
  const manifest = await file.json();

  const pluginName = manifest.id;
  console.log(
    `Creating symlink to ${projectRootDirectory} for plugin ${pluginName} in ${pluginsDirectoryPath}`,
  );

  if (!existsSync(pluginsDirectoryPath)) {
    mkdirSync(pluginsDirectoryPath, { recursive: true });
  }

  const targetPath = join(pluginsDirectoryPath, pluginName);

  if (existsSync(targetPath)) {
    console.log("Symlink already exists.");
    return;
  }

  symlinkSync(projectRootDirectory, targetPath, "dir");
  console.log("Symlink created successfully.");

  console.log(
    "Obsidian plugin linked for local development. Please restart Obsidian.",
  );
}

main().catch(console.error);
