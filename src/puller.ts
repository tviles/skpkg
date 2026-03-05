import * as fs from "node:fs";
import * as path from "node:path";
import { input, select } from "@inquirer/prompts";
import type { Manifest, ManifestV2, ManifestItem } from "./types.js";

function getClaudeDir(): string {
  return path.join(process.env.HOME ?? "~", ".claude");
}

function getExistingNames(claudeDir: string, type: string): Set<string> {
  const names = new Set<string>();
  let dir: string;

  if (type === "skill") {
    dir = path.join(claudeDir, "skills");
    if (fs.existsSync(dir)) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) names.add(entry.name);
      }
    }
  } else {
    dir = path.join(claudeDir, type === "command" ? "commands" : "agents");
    if (fs.existsSync(dir)) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isFile() && entry.name.endsWith(".md")) {
          names.add(entry.name.replace(/\.md$/, ""));
        }
      }
    }
  }

  return names;
}

function renamePaths(item: ManifestItem, oldName: string, newName: string): Record<string, string> {
  const renamed: Record<string, string> = {};
  for (const [origPath, gistName] of Object.entries(item.files)) {
    const newPath = origPath.replace(oldName, newName);
    renamed[newPath] = gistName;
  }
  return renamed;
}

export interface PulledItem {
  type: string;
  name: string;
  fileContents: Record<string, string>; // relative path -> content
}

export async function pull(
  gistFiles: Record<string, string>,
  claudeDir?: string,
): Promise<PulledItem[]> {
  const dir = claudeDir ?? getClaudeDir();
  const manifestContent = gistFiles["manifest.json"];

  if (!manifestContent) {
    console.error("Error: No manifest.json found in gist. This may not be a skpkg bundle.");
    process.exit(1);
  }

  const manifest: Manifest | ManifestV2 = JSON.parse(manifestContent);

  if (manifest.version !== 1 && manifest.version !== 2) {
    console.error(`Error: Unsupported manifest version ${(manifest as any).version}.`);
    process.exit(1);
  }

  const pulled: PulledItem[] = [];

  for (const item of manifest.items) {
    const existing = getExistingNames(dir, item.type);
    let filesToWrite = item.files;

    if (existing.has(item.name)) {
      const action = await select({
        message: `"${item.name}" (${item.type}) already exists. What do you want to do?`,
        choices: [
          { name: "Overwrite", value: "overwrite" },
          { name: "Skip", value: "skip" },
          { name: "Rename", value: "rename" },
        ],
      });

      if (action === "skip") {
        console.log(`Skipped: ${item.name}`);
        continue;
      }

      if (action === "rename") {
        const newName = await input({
          message: `Enter a new name for "${item.name}":`,
        });
        filesToWrite = renamePaths(item, item.name, newName);
      }
    }

    const fileContents: Record<string, string> = {};

    for (const [origPath, gistFilename] of Object.entries(filesToWrite)) {
      const content = gistFiles[gistFilename];
      if (content === undefined) {
        console.warn(`Warning: Missing file "${gistFilename}" in gist, skipping`);
        continue;
      }

      const fullPath = path.join(dir, origPath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
      fileContents[origPath] = content;
    }

    pulled.push({ type: item.type, name: item.name, fileContents });
    console.log(`Installed: ${item.name} (${item.type})`);
  }

  return pulled;
}
