import { version } from "../../../../obsidian-plugin/package.json" with { type: "json" };

export function getVersion() {
  return version;
}
