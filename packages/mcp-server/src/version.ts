import path from "path";

export async function getVersion() {
  const file = Bun.file(
    path.resolve(import.meta.dir, "../../obsidian-plugin/package.json"),
  );
  const { version } = await file.json();
  return version;
}
