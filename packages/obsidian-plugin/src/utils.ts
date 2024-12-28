import { App, TFile } from "obsidian";

export function getFrontMatterData(promptFile: TFile, app: App) {
	return new Promise((resolve) => {
		app.fileManager.processFrontMatter(promptFile, (f) =>
			resolve(structuredClone(f)),
		);
	});
}
