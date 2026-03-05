import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { scan } from "../src/scanner.js";

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "skpkg-test-"));
}

function writeFile(base: string, relativePath: string, content: string) {
  const full = path.join(base, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

describe("scanner", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("scans skills with YAML frontmatter", () => {
    writeFile(tmpDir, "skills/my-skill/SKILL.md", `---
name: my-skill
description: A test skill
---
# My Skill
Content here`);

    const items = scan(tmpDir);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: "skill",
      name: "my-skill",
      description: "A test skill",
    });
    expect(items[0].files).toContain("skills/my-skill/SKILL.md");
  });

  it("includes all text files in skill directories", () => {
    writeFile(tmpDir, "skills/multi/SKILL.md", `---
name: multi
description: Multi-file skill
---
# Multi`);
    writeFile(tmpDir, "skills/multi/helper.ts", "export const x = 1;");
    writeFile(tmpDir, "skills/multi/sub/nested.md", "nested content");

    const items = scan(tmpDir);
    expect(items).toHaveLength(1);
    expect(items[0].files).toHaveLength(3);
    expect(items[0].files).toContain("skills/multi/SKILL.md");
    expect(items[0].files).toContain("skills/multi/helper.ts");
    expect(items[0].files).toContain("skills/multi/sub/nested.md");
  });

  it("skips binary files in skills with warning", () => {
    writeFile(tmpDir, "skills/with-binary/SKILL.md", `---
name: with-binary
description: Has binary
---
# Skill`);
    writeFile(tmpDir, "skills/with-binary/icon.png", "fake binary");

    const warns: string[] = [];
    const origWarn = console.warn;
    console.warn = (msg: string) => warns.push(msg);

    const items = scan(tmpDir);

    console.warn = origWarn;
    expect(items).toHaveLength(1);
    expect(items[0].files).toHaveLength(1);
    expect(warns.some(w => w.includes("binary"))).toBe(true);
  });

  it("scans commands", () => {
    writeFile(tmpDir, "commands/my-cmd.md", `---
name: my-cmd
description: A command
---
# Command`);

    const items = scan(tmpDir);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: "command",
      name: "my-cmd",
      description: "A command",
    });
  });

  it("scans agents", () => {
    writeFile(tmpDir, "agents/my-agent.md", `---
name: my-agent
description: An agent
---
# Agent`);

    const items = scan(tmpDir);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: "agent",
      name: "my-agent",
      description: "An agent",
    });
  });

  it("skips items with no frontmatter", () => {
    writeFile(tmpDir, "commands/no-front.md", "# No Frontmatter");

    const warns: string[] = [];
    const origWarn = console.warn;
    console.warn = (msg: string) => warns.push(msg);

    const items = scan(tmpDir);

    console.warn = origWarn;
    expect(items).toHaveLength(0);
    expect(warns.some(w => w.includes("Skipping"))).toBe(true);
  });

  it("handles missing directories gracefully", () => {
    const emptyDir = createTempDir();
    const items = scan(emptyDir);
    expect(items).toHaveLength(0);
    fs.rmSync(emptyDir, { recursive: true, force: true });
  });

  it("filters by category when specified", () => {
    writeFile(tmpDir, "skills/s1/SKILL.md", `---\nname: s1\ndescription: skill\n---\ncontent`);
    writeFile(tmpDir, "commands/c1.md", `---\nname: c1\ndescription: cmd\n---\ncontent`);
    writeFile(tmpDir, "agents/a1.md", `---\nname: a1\ndescription: agent\n---\ncontent`);

    const skillsOnly = scan(tmpDir, "skills");
    expect(skillsOnly).toHaveLength(1);
    expect(skillsOnly[0].type).toBe("skill");

    const commandsOnly = scan(tmpDir, "commands");
    expect(commandsOnly).toHaveLength(1);
    expect(commandsOnly[0].type).toBe("command");

    const agentsOnly = scan(tmpDir, "agents");
    expect(agentsOnly).toHaveLength(1);
    expect(agentsOnly[0].type).toBe("agent");
  });

  it("scans all types together", () => {
    writeFile(tmpDir, "skills/s1/SKILL.md", `---
name: s1
description: skill 1
---
content`);
    writeFile(tmpDir, "commands/c1.md", `---
name: c1
description: cmd 1
---
content`);
    writeFile(tmpDir, "agents/a1.md", `---
name: a1
description: agent 1
---
content`);

    const items = scan(tmpDir);
    expect(items).toHaveLength(3);
    expect(items.map(i => i.type).sort()).toEqual(["agent", "command", "skill"]);
  });
});
