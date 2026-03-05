import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// Mock inquirer prompts to avoid interactive input in tests
vi.mock("@inquirer/prompts", () => ({
  select: vi.fn(),
  input: vi.fn(),
}));

import { select, input } from "@inquirer/prompts";
import { pull } from "../src/puller.js";

const mockedSelect = vi.mocked(select);
const mockedInput = vi.mocked(input);

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "skpkg-puller-"));
}

function writeFile(base: string, relativePath: string, content: string) {
  const full = path.join(base, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

describe("puller", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
    vi.clearAllMocks();
    vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as never);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("pulls a command into the correct directory", async () => {
    const gistFiles: Record<string, string> = {
      "manifest.json": JSON.stringify({
        version: 1,
        items: [{
          type: "command",
          name: "test-cmd",
          files: { "commands/test-cmd.md": "commands___test-cmd.md" },
        }],
      }),
      "commands___test-cmd.md": "# Test Command",
    };

    await pull(gistFiles, tmpDir);
    const written = fs.readFileSync(path.join(tmpDir, "commands/test-cmd.md"), "utf-8");
    expect(written).toBe("# Test Command");
  });

  it("pulls a multi-file skill", async () => {
    const gistFiles: Record<string, string> = {
      "manifest.json": JSON.stringify({
        version: 1,
        items: [{
          type: "skill",
          name: "my-skill",
          files: {
            "skills/my-skill/SKILL.md": "skills___my-skill___SKILL.md",
            "skills/my-skill/helper.ts": "skills___my-skill___helper.ts",
          },
        }],
      }),
      "skills___my-skill___SKILL.md": "skill content",
      "skills___my-skill___helper.ts": "helper content",
    };

    await pull(gistFiles, tmpDir);
    expect(fs.readFileSync(path.join(tmpDir, "skills/my-skill/SKILL.md"), "utf-8")).toBe("skill content");
    expect(fs.readFileSync(path.join(tmpDir, "skills/my-skill/helper.ts"), "utf-8")).toBe("helper content");
  });

  it("prompts on conflict and skips when requested", async () => {
    writeFile(tmpDir, "commands/existing.md", "old content");

    mockedSelect.mockResolvedValueOnce("skip" as never);

    const gistFiles: Record<string, string> = {
      "manifest.json": JSON.stringify({
        version: 1,
        items: [{
          type: "command",
          name: "existing",
          files: { "commands/existing.md": "commands___existing.md" },
        }],
      }),
      "commands___existing.md": "new content",
    };

    await pull(gistFiles, tmpDir);
    expect(fs.readFileSync(path.join(tmpDir, "commands/existing.md"), "utf-8")).toBe("old content");
  });

  it("prompts on conflict and overwrites when requested", async () => {
    writeFile(tmpDir, "commands/existing.md", "old content");

    mockedSelect.mockResolvedValueOnce("overwrite" as never);

    const gistFiles: Record<string, string> = {
      "manifest.json": JSON.stringify({
        version: 1,
        items: [{
          type: "command",
          name: "existing",
          files: { "commands/existing.md": "commands___existing.md" },
        }],
      }),
      "commands___existing.md": "new content",
    };

    await pull(gistFiles, tmpDir);
    expect(fs.readFileSync(path.join(tmpDir, "commands/existing.md"), "utf-8")).toBe("new content");
  });

  it("prompts on conflict and renames when requested", async () => {
    writeFile(tmpDir, "commands/existing.md", "old content");

    mockedSelect.mockResolvedValueOnce("rename" as never);
    mockedInput.mockResolvedValueOnce("renamed-cmd" as never);

    const gistFiles: Record<string, string> = {
      "manifest.json": JSON.stringify({
        version: 1,
        items: [{
          type: "command",
          name: "existing",
          files: { "commands/existing.md": "commands___existing.md" },
        }],
      }),
      "commands___existing.md": "new content",
    };

    await pull(gistFiles, tmpDir);
    expect(fs.readFileSync(path.join(tmpDir, "commands/existing.md"), "utf-8")).toBe("old content");
    expect(fs.readFileSync(path.join(tmpDir, "commands/renamed-cmd.md"), "utf-8")).toBe("new content");
  });

  it("fails on missing manifest", async () => {
    await expect(pull({}, tmpDir)).rejects.toThrow("process.exit called");
  });

  it("handles manifest v2", async () => {
    const gistFiles: Record<string, string> = {
      "manifest.json": JSON.stringify({
        version: 2,
        type: "commands",
        items: [{
          type: "command",
          name: "test-cmd",
          files: { "commands/test-cmd.md": "commands___test-cmd.md" },
        }],
      }),
      "commands___test-cmd.md": "# Test Command v2",
    };

    const result = await pull(gistFiles, tmpDir);
    const written = fs.readFileSync(path.join(tmpDir, "commands/test-cmd.md"), "utf-8");
    expect(written).toBe("# Test Command v2");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("test-cmd");
  });

  it("returns installed item info with file content", async () => {
    const gistFiles: Record<string, string> = {
      "manifest.json": JSON.stringify({
        version: 1,
        items: [{
          type: "command",
          name: "test-cmd",
          files: { "commands/test-cmd.md": "commands___test-cmd.md" },
        }],
      }),
      "commands___test-cmd.md": "# Content",
    };

    const result = await pull(gistFiles, tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "command",
      name: "test-cmd",
    });
    expect(result[0].fileContents["commands/test-cmd.md"]).toBe("# Content");
  });
});
