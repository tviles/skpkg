import * as fs from "node:fs";
import * as path from "node:path";
import type { Manifest, ManifestV2, CategoryType, ScannedItem } from "./types.js";

function toGistFilename(relativePath: string): string {
  return relativePath.replace(/\//g, "___");
}

export function bundle(items: ScannedItem[], claudeDir: string, category?: CategoryType): Record<string, string> {
  const files: Record<string, string> = {};

  const manifestItems = items.map(item => ({
    type: item.type,
    name: item.name,
    files: Object.fromEntries(
      item.files.map(f => [f, toGistFilename(f)])
    ),
  }));

  const manifest: Manifest | ManifestV2 = category
    ? { version: 2, type: category, items: manifestItems }
    : { version: 1, items: manifestItems };

  files["manifest.json"] = JSON.stringify(manifest, null, 2);

  for (const item of items) {
    for (const relPath of item.files) {
      const fullPath = path.join(claudeDir, relPath);
      const content = fs.readFileSync(fullPath, "utf-8");
      files[toGistFilename(relPath)] = content;
    }
  }

  return files;
}
