import { describe, it, expect } from "vitest";
import { mergeGistFiles } from "../src/merger.js";
import type { ManifestV2 } from "../src/types.js";

describe("mergeGistFiles", () => {
  const existingManifest: ManifestV2 = {
    version: 2,
    type: "skills",
    items: [
      { type: "skill", name: "skill1", files: { "skills/skill1/SKILL.md": "skills___skill1___SKILL.md" } },
      { type: "skill", name: "skill2", files: { "skills/skill2/SKILL.md": "skills___skill2___SKILL.md" } },
    ],
  };

  const existingFiles: Record<string, string> = {
    "manifest.json": JSON.stringify(existingManifest),
    "skills___skill1___SKILL.md": "skill1 content",
    "skills___skill2___SKILL.md": "skill2 content",
  };

  it("adds new items to existing gist", () => {
    const newManifest: ManifestV2 = {
      version: 2,
      type: "skills",
      items: [
        { type: "skill", name: "skill3", files: { "skills/skill3/SKILL.md": "skills___skill3___SKILL.md" } },
      ],
    };
    const newFiles: Record<string, string> = {
      "manifest.json": JSON.stringify(newManifest),
      "skills___skill3___SKILL.md": "skill3 content",
    };

    const result = mergeGistFiles(existingFiles, newFiles, ["skill3"], "skills");

    const manifest: ManifestV2 = JSON.parse(result["manifest.json"]);
    expect(manifest.items).toHaveLength(3);
    expect(manifest.items.map(i => i.name).sort()).toEqual(["skill1", "skill2", "skill3"]);
    expect(result["skills___skill1___SKILL.md"]).toBe("skill1 content");
    expect(result["skills___skill2___SKILL.md"]).toBe("skill2 content");
    expect(result["skills___skill3___SKILL.md"]).toBe("skill3 content");
  });

  it("overwrites accepted existing items", () => {
    const newManifest: ManifestV2 = {
      version: 2,
      type: "skills",
      items: [
        { type: "skill", name: "skill1", files: { "skills/skill1/SKILL.md": "skills___skill1___SKILL.md" } },
      ],
    };
    const newFiles: Record<string, string> = {
      "manifest.json": JSON.stringify(newManifest),
      "skills___skill1___SKILL.md": "skill1 UPDATED",
    };

    const result = mergeGistFiles(existingFiles, newFiles, ["skill1"], "skills");

    const manifest: ManifestV2 = JSON.parse(result["manifest.json"]);
    expect(manifest.items).toHaveLength(2);
    expect(result["skills___skill1___SKILL.md"]).toBe("skill1 UPDATED");
    expect(result["skills___skill2___SKILL.md"]).toBe("skill2 content");
  });

  it("skips items not in acceptedNames", () => {
    const newManifest: ManifestV2 = {
      version: 2,
      type: "skills",
      items: [
        { type: "skill", name: "skill1", files: { "skills/skill1/SKILL.md": "skills___skill1___SKILL.md" } },
        { type: "skill", name: "skill3", files: { "skills/skill3/SKILL.md": "skills___skill3___SKILL.md" } },
      ],
    };
    const newFiles: Record<string, string> = {
      "manifest.json": JSON.stringify(newManifest),
      "skills___skill1___SKILL.md": "skill1 UPDATED",
      "skills___skill3___SKILL.md": "skill3 content",
    };

    // Only skill3 accepted (skill1 overwrite was declined)
    const result = mergeGistFiles(existingFiles, newFiles, ["skill3"], "skills");

    const manifest: ManifestV2 = JSON.parse(result["manifest.json"]);
    expect(manifest.items).toHaveLength(3);
    expect(result["skills___skill1___SKILL.md"]).toBe("skill1 content"); // unchanged
    expect(result["skills___skill3___SKILL.md"]).toBe("skill3 content"); // added
  });

  it("handles missing manifest in existing gist", () => {
    const existingNoManifest: Record<string, string> = {
      "skills___old___SKILL.md": "old content",
    };
    const newManifest: ManifestV2 = {
      version: 2,
      type: "skills",
      items: [
        { type: "skill", name: "skill1", files: { "skills/skill1/SKILL.md": "skills___skill1___SKILL.md" } },
      ],
    };
    const newFiles: Record<string, string> = {
      "manifest.json": JSON.stringify(newManifest),
      "skills___skill1___SKILL.md": "skill1 content",
    };

    const result = mergeGistFiles(existingNoManifest, newFiles, ["skill1"], "skills");

    const manifest: ManifestV2 = JSON.parse(result["manifest.json"]);
    expect(manifest.items).toHaveLength(1);
    expect(manifest.items[0].name).toBe("skill1");
  });

  it("removes orphaned files when overwriting a multi-file skill", () => {
    const existingMultiFile: ManifestV2 = {
      version: 2,
      type: "skills",
      items: [
        {
          type: "skill",
          name: "skill1",
          files: {
            "skills/skill1/SKILL.md": "skills___skill1___SKILL.md",
            "skills/skill1/helper.py": "skills___skill1___helper.py",
          },
        },
        { type: "skill", name: "skill2", files: { "skills/skill2/SKILL.md": "skills___skill2___SKILL.md" } },
      ],
    };
    const existingMultiFiles: Record<string, string> = {
      "manifest.json": JSON.stringify(existingMultiFile),
      "skills___skill1___SKILL.md": "skill1 content",
      "skills___skill1___helper.py": "helper content",
      "skills___skill2___SKILL.md": "skill2 content",
    };

    // New version of skill1 only has SKILL.md (no helper.py)
    const newManifest: ManifestV2 = {
      version: 2,
      type: "skills",
      items: [
        { type: "skill", name: "skill1", files: { "skills/skill1/SKILL.md": "skills___skill1___SKILL.md" } },
      ],
    };
    const newFiles: Record<string, string> = {
      "manifest.json": JSON.stringify(newManifest),
      "skills___skill1___SKILL.md": "skill1 UPDATED",
    };

    const result = mergeGistFiles(existingMultiFiles, newFiles, ["skill1"], "skills");

    const manifest: ManifestV2 = JSON.parse(result["manifest.json"]);
    expect(manifest.items).toHaveLength(2);
    expect(result["skills___skill1___SKILL.md"]).toBe("skill1 UPDATED");
    expect(result["skills___skill2___SKILL.md"]).toBe("skill2 content");
    // Orphaned file from old skill1 should be removed
    expect(result["skills___skill1___helper.py"]).toBeUndefined();
  });

  it("upgrades v1 manifest to v2", () => {
    const v1Manifest = { version: 1, items: existingManifest.items };
    const existingV1: Record<string, string> = {
      ...existingFiles,
      "manifest.json": JSON.stringify(v1Manifest),
    };
    const newManifest: ManifestV2 = {
      version: 2,
      type: "skills",
      items: [
        { type: "skill", name: "skill3", files: { "skills/skill3/SKILL.md": "skills___skill3___SKILL.md" } },
      ],
    };
    const newFiles: Record<string, string> = {
      "manifest.json": JSON.stringify(newManifest),
      "skills___skill3___SKILL.md": "skill3 content",
    };

    const result = mergeGistFiles(existingV1, newFiles, ["skill3"], "skills");

    const manifest = JSON.parse(result["manifest.json"]);
    expect(manifest.version).toBe(2);
    expect(manifest.type).toBe("skills");
    expect(manifest.items).toHaveLength(3);
  });
});
