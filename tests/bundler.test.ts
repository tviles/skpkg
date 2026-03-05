import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { bundle } from "../src/bundler.js";
import type { Manifest, ManifestV2, ScannedItem } from "../src/types.js";

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "skpkg-bundler-"));
}

function writeFile(base: string, relativePath: string, content: string) {
  const full = path.join(base, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

describe("bundler", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("bundles a command into flat gist files", () => {
    writeFile(tmpDir, "commands/test-cmd.md", "---\nname: test-cmd\n---\n# Test");

    const items: ScannedItem[] = [{
      type: "command",
      name: "test-cmd",
      description: "A test command",
      files: ["commands/test-cmd.md"],
    }];

    const result = bundle(items, tmpDir);

    expect(result["manifest.json"]).toBeDefined();
    expect(result["commands___test-cmd.md"]).toBe("---\nname: test-cmd\n---\n# Test");

    const manifest: Manifest = JSON.parse(result["manifest.json"]);
    expect(manifest.version).toBe(1);
    expect(manifest.items).toHaveLength(1);
    expect(manifest.items[0].files["commands/test-cmd.md"]).toBe("commands___test-cmd.md");
  });

  it("bundles a multi-file skill", () => {
    writeFile(tmpDir, "skills/my-skill/SKILL.md", "skill content");
    writeFile(tmpDir, "skills/my-skill/helper.ts", "helper content");

    const items: ScannedItem[] = [{
      type: "skill",
      name: "my-skill",
      description: "A skill",
      files: ["skills/my-skill/SKILL.md", "skills/my-skill/helper.ts"],
    }];

    const result = bundle(items, tmpDir);

    expect(result["skills___my-skill___SKILL.md"]).toBe("skill content");
    expect(result["skills___my-skill___helper.ts"]).toBe("helper content");
  });

  it("bundles multiple items", () => {
    writeFile(tmpDir, "commands/cmd.md", "cmd");
    writeFile(tmpDir, "agents/agent.md", "agent");

    const items: ScannedItem[] = [
      { type: "command", name: "cmd", description: "", files: ["commands/cmd.md"] },
      { type: "agent", name: "agent", description: "", files: ["agents/agent.md"] },
    ];

    const result = bundle(items, tmpDir);
    const manifest: Manifest = JSON.parse(result["manifest.json"]);
    expect(manifest.items).toHaveLength(2);
    expect(Object.keys(result)).toHaveLength(3); // manifest + 2 files
  });

  it("produces manifest v2 when category is specified", () => {
    writeFile(tmpDir, "commands/test-cmd.md", "---\nname: test-cmd\n---\n# Test");

    const items: ScannedItem[] = [{
      type: "command",
      name: "test-cmd",
      description: "A test command",
      files: ["commands/test-cmd.md"],
    }];

    const result = bundle(items, tmpDir, "commands");

    const manifest: ManifestV2 = JSON.parse(result["manifest.json"]);
    expect(manifest.version).toBe(2);
    expect(manifest.type).toBe("commands");
    expect(manifest.items).toHaveLength(1);
  });

  it("produces manifest v1 when no category is specified (backwards compat)", () => {
    writeFile(tmpDir, "commands/test-cmd.md", "---\nname: test-cmd\n---\n# Test");

    const items: ScannedItem[] = [{
      type: "command",
      name: "test-cmd",
      description: "",
      files: ["commands/test-cmd.md"],
    }];

    const result = bundle(items, tmpDir);
    const manifest = JSON.parse(result["manifest.json"]);
    expect(manifest.version).toBe(1);
    expect(manifest.type).toBeUndefined();
  });
});
