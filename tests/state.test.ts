import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { loadState, saveState, hashContent } from "../src/state.js";
import type { StateFile } from "../src/types.js";

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "skpkg-state-"));
}

describe("state", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty state when file does not exist", () => {
    const state = loadState(tmpDir);
    expect(state).toEqual({ version: 1, published: {}, installed: {} });
  });

  it("reads existing state file", () => {
    const existing: StateFile = {
      version: 1,
      published: { skills: { gistId: "abc", public: true, updatedAt: "2026-01-01T00:00:00Z" } },
      installed: {},
    };
    fs.writeFileSync(path.join(tmpDir, "skpkg.json"), JSON.stringify(existing));

    const state = loadState(tmpDir);
    expect(state.published.skills?.gistId).toBe("abc");
  });

  it("saves state file", () => {
    const state: StateFile = {
      version: 1,
      published: {},
      installed: {
        "@alice/commands": {
          gistId: "def",
          pulledAt: "2026-01-01T00:00:00Z",
          items: [],
        },
      },
    };
    saveState(tmpDir, state);

    const raw = fs.readFileSync(path.join(tmpDir, "skpkg.json"), "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.installed["@alice/commands"].gistId).toBe("def");
  });

  it("hashContent produces consistent sha256 hex", () => {
    const hash1 = hashContent("hello world");
    const hash2 = hashContent("hello world");
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("hashContent produces different hashes for different content", () => {
    expect(hashContent("hello")).not.toBe(hashContent("world"));
  });
});
