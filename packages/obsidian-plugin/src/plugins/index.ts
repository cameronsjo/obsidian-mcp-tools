import { App } from "obsidian";
import { getAPI } from "obsidian-local-rest-api";
import type { SmartSearch } from "./SmartSearch";
import type { ITemplater } from "./Templater";
import { loadPluginAPI } from "./loadPluginAPI";

export const loadSmartSearchAPI = loadPluginAPI(function getSmartSearchAPI():
	| SmartSearch
	| undefined {
	return typeof SmartSearch === "object" ? SmartSearch : undefined;
});

const getLocalRestAPI = getAPI; // change the name of the function
export const loadLocalRestAPI = loadPluginAPI(getLocalRestAPI);

export const loadTemplaterAPI = loadPluginAPI(function getTemplaterAPI(
	app: App,
) {
	// @ts-expect-error The Obsidian types don't know anything about individual plugins
	return app.plugins.plugins["templater-obsidian"]?.templater as ITemplater;
});
