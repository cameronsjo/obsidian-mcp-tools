import { symlinkSync, existsSync, mkdirSync } from "fs";
import { join, resolve } from "node:path";

async function main() {
	const args = process.argv.slice(2);
	if (args.length < 1) {
		console.error("Usage: bun scripts/link.ts <path_to_obsidian_vault>");
		process.exit(1);
	}
	const vaultPath = args[0];

	const manifestPath = resolve(__dirname, "../manifest.json");
	const file = Bun.file(manifestPath);
	const manifest = await file.json();

	const pluginsPath = join(vaultPath, ".obsidian", "plugins");
	const pluginName = manifest.id;
	const sourcePath = resolve(__dirname, "..");
	console.log(
		`Creating symlink to ${sourcePath} for plugin ${pluginName} in ${pluginsPath}`,
	);

	if (!existsSync(pluginsPath)) {
		mkdirSync(pluginsPath, { recursive: true });
	}

	const targetPath = join(pluginsPath, pluginName);

	if (existsSync(targetPath)) {
		console.log("Symlink already exists.");
		return;
	}

	symlinkSync(sourcePath, targetPath, "dir");
	console.log("Symlink created successfully.");

	console.log("Obsidian plugin linked for local development. Please restart Obsidian.");
}

main().catch(console.error);
