import { getAPI, LocalRestApiPublicApi } from "obsidian-local-rest-api";
import {
  distinct,
  interval,
  map,
  merge,
  scan,
  takeUntil,
  takeWhile,
  timer,
} from "rxjs";
import type { SmartConnections, Templater } from "shared";
import type McpToolsPlugin from "src/main";

export interface Dependency<API> {
  id: keyof Dependencies;
  name: string;
  required: boolean;
  installed: boolean;
  url?: string;
  api?: API;
}

interface Dependencies {
  "obsidian-local-rest-api": Dependency<LocalRestApiPublicApi>;
  "smart-connections": Dependency<SmartConnections.SmartSearch>;
  "templater-obsidian": Dependency<Templater.ITemplater>;
}

export const loadSmartSearchAPI = (plugin: McpToolsPlugin) =>
  interval(200).pipe(
    takeUntil(timer(5000)),
    map((): Dependency<SmartConnections.SmartSearch> => {
      const api = typeof SmartSearch === "undefined" ? undefined : SmartSearch;
      return {
        id: "smart-connections",
        name: "Smart Connections",
        required: false,
        installed: !!api,
        api,
      };
    }),
    takeWhile((dependency) => !dependency.installed, true),
    distinct(({ installed }) => installed),
  );

export const loadLocalRestAPI = (plugin: McpToolsPlugin) =>
  interval(200).pipe(
    takeUntil(timer(5000)),
    map((): Dependency<LocalRestApiPublicApi> => {
      const api = getAPI(plugin.app, plugin.manifest);
      return {
        id: "obsidian-local-rest-api",
        name: "Local REST API",
        required: true,
        installed: !!api,
        api,
      };
    }),
    takeWhile((dependency) => !dependency.installed, true),
    distinct(({ installed }) => installed),
  );

export const loadTemplaterAPI = (plugin: McpToolsPlugin) =>
  interval(200).pipe(
    takeUntil(timer(5000)),
    map((): Dependency<Templater.ITemplater> => {
      const api = plugin.app.plugins.plugins["templater-obsidian"]?.templater;
      return {
        id: "templater-obsidian",
        name: "Templater",
        required: false,
        installed: !!api,
        api,
      };
    }),
    takeWhile((dependency) => !dependency.installed, true),
    distinct(({ installed }) => installed),
  );

export const loadDependencies = (plugin: McpToolsPlugin) => {
  const dependencies: Dependencies = {
    "obsidian-local-rest-api": {
      id: "obsidian-local-rest-api",
      name: "Local REST API",
      required: true,
      installed: false,
    },
    "smart-connections": {
      id: "smart-connections",
      name: "Smart Connections",
      required: false,
      installed: false,
    },
    "templater-obsidian": {
      id: "templater-obsidian",
      name: "Templater",
      required: false,
      installed: false,
    },
  };
  return merge(
    loadLocalRestAPI(plugin),
    loadTemplaterAPI(plugin),
    loadSmartSearchAPI(plugin),
  ).pipe(
    scan((acc, dependency) => {
      // @ts-expect-error Dynamic key assignment
      acc[dependency.id] = dependency;
      return acc;
    }, dependencies),
  );
};
