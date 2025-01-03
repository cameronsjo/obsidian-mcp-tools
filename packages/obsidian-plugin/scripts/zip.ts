import { create } from "archiver";
import { createWriteStream } from "fs";
import fs from "fs-extra";
import { join, resolve } from "path";
import { version } from "../../../package.json" with { type: "json" };

async function zipPlugin() {
  const pluginDir = resolve(import.meta.dir, "..");

  const releaseDir = join(pluginDir, "releases");
  fs.ensureDirSync(releaseDir);

  const zipFilePath = join(releaseDir, `obsidian-plugin-${version}.zip`);
  const output = createWriteStream(zipFilePath);

  const archive = create("zip", { zlib: { level: 9 } });
  archive.pipe(output);

  // Add the required files
  archive.file(join(pluginDir, "main.js"), { name: "main.js" });
  archive.file(join(pluginDir, "manifest.json"), { name: "manifest.json" });
  archive.file(join(pluginDir, "styles.css"), { name: "styles.css" });

  await archive.finalize();
  console.log("Plugin files zipped successfully!");
}

zipPlugin().catch(console.error);
