import type { Manifest, ManifestV2, ManifestItem, CategoryType } from "./types.js";

export function mergeGistFiles(
  existingFiles: Record<string, string>,
  newFiles: Record<string, string>,
  acceptedNames: string[],
  category: CategoryType,
): Record<string, string> {
  let existingItems: ManifestItem[] = [];
  if (existingFiles["manifest.json"]) {
    try {
      const parsed: Manifest | ManifestV2 = JSON.parse(existingFiles["manifest.json"]);
      existingItems = parsed.items ?? [];
    } catch {
      existingItems = [];
    }
  }

  const newManifest: ManifestV2 = JSON.parse(newFiles["manifest.json"]);
  const acceptedSet = new Set(acceptedNames);

  const acceptedNewItems = newManifest.items.filter(item => acceptedSet.has(item.name));

  const overwrittenNames = new Set(acceptedNewItems.map(i => i.name));
  const keptExistingItems = existingItems.filter(item => !overwrittenNames.has(item.name));
  const mergedItems = [...keptExistingItems, ...acceptedNewItems];

  const merged: Record<string, string> = { ...existingFiles };

  // Remove files from overwritten existing items
  for (const item of existingItems.filter(i => overwrittenNames.has(i.name))) {
    for (const gistFilename of Object.values(item.files)) {
      delete merged[gistFilename];
    }
  }

  for (const item of acceptedNewItems) {
    for (const gistFilename of Object.values(item.files)) {
      if (newFiles[gistFilename] !== undefined) {
        merged[gistFilename] = newFiles[gistFilename];
      }
    }
  }

  const mergedManifest: ManifestV2 = {
    version: 2,
    type: category,
    items: mergedItems,
  };
  merged["manifest.json"] = JSON.stringify(mergedManifest, null, 2);

  return merged;
}
