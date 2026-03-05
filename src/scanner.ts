import * as fs from "node:fs";
import * as path from "node:path";
import matter from "gray-matter";
import type { CategoryType, ItemType, ScannedItem } from "./types.js";

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".ico", ".webp", ".svg",
  ".zip", ".tar", ".gz", ".woff", ".woff2", ".ttf", ".eot",
  ".mp3", ".mp4", ".DS_Store",
]);

function getClaudeDir(): string {
  return path.join(process.env.HOME ?? "~", ".claude");
}

function isBinary(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.has(ext) || path.basename(filePath) === ".DS_Store";
}

function getAllFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllFiles(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

function parseFrontmatter(filePath: string): { name: string; description: string } | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const { data } = matter(content);
    if (!data.name && !data.description) return null;
    return {
      name: data.name ?? path.basename(filePath, ".md"),
      description: data.description ?? "",
    };
  } catch {
    return null;
  }
}

function scanSkills(claudeDir: string): ScannedItem[] {
  const skillsDir = path.join(claudeDir, "skills");
  if (!fs.existsSync(skillsDir)) return [];

  const items: ScannedItem[] = [];
  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillDir = path.join(skillsDir, entry.name);
    const skillFile = path.join(skillDir, "SKILL.md");
    if (!fs.existsSync(skillFile)) continue;

    const meta = parseFrontmatter(skillFile);
    if (!meta) {
      console.warn(`Warning: Skipping skill "${entry.name}" — no valid frontmatter`);
      continue;
    }

    const allFiles = getAllFiles(skillDir);
    const textFiles: string[] = [];
    const skippedFiles: string[] = [];

    for (const f of allFiles) {
      if (isBinary(f)) {
        skippedFiles.push(path.relative(claudeDir, f));
      } else {
        textFiles.push(path.relative(claudeDir, f));
      }
    }

    if (skippedFiles.length > 0) {
      console.warn(`Warning: Skipping binary files in skill "${meta.name}": ${skippedFiles.join(", ")}`);
    }

    items.push({
      type: "skill",
      name: meta.name,
      description: meta.description,
      files: textFiles,
    });
  }

  return items;
}

function scanSimpleItems(claudeDir: string, type: ItemType, subdir: string): ScannedItem[] {
  const dir = path.join(claudeDir, subdir);
  if (!fs.existsSync(dir)) return [];

  const items: ScannedItem[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const filePath = path.join(dir, entry.name);
    const meta = parseFrontmatter(filePath);
    if (!meta) {
      console.warn(`Warning: Skipping ${type} "${entry.name}" — no valid frontmatter`);
      continue;
    }

    items.push({
      type,
      name: meta.name,
      description: meta.description,
      files: [path.relative(claudeDir, filePath)],
    });
  }

  return items;
}

export function scan(claudeDir?: string, category?: CategoryType): ScannedItem[] {
  const dir = claudeDir ?? getClaudeDir();
  const items: ScannedItem[] = [];

  if (!category || category === "skills") items.push(...scanSkills(dir));
  if (!category || category === "commands") items.push(...scanSimpleItems(dir, "command", "commands"));
  if (!category || category === "agents") items.push(...scanSimpleItems(dir, "agent", "agents"));

  return items;
}
