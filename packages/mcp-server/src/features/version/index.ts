import { version } from "../../../../../package.json" with { type: "json" };

export function getVersion() {
  return version;
}
