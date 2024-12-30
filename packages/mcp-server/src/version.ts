import path from "path";
import fs from "fs";

export async function getVersion() {
  try {
    const packageJson = path.resolve(
      import.meta.dir,
      "../../obsidian-plugin/package.json",
    );
    const { version } = JSON.parse(fs.readFileSync(packageJson, "utf-8"));
    return version;
  } catch (error) {
    throw new Error(`Error getting version: ${error}`);
  }
}
