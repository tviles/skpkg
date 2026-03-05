import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
import type { StateFile } from "./types.js";

const STATE_FILENAME = "skpkg.json";

function emptyState(): StateFile {
  return { version: 1, published: {}, installed: {} };
}

export function loadState(claudeDir: string): StateFile {
  const filePath = path.join(claudeDir, STATE_FILENAME);
  if (!fs.existsSync(filePath)) return emptyState();

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as StateFile;
  } catch {
    return emptyState();
  }
}

export function saveState(claudeDir: string, state: StateFile): void {
  const filePath = path.join(claudeDir, STATE_FILENAME);
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
}

export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}
