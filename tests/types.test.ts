import { describe, it, expect } from "vitest";
import type {
  ItemType,
  Manifest,
  ManifestV2,
  CategoryType,
  PublishedEntry,
  InstalledItem,
  InstalledEntry,
  StateFile,
} from "../src/types.js";

describe("types", () => {
  it("ManifestV2 includes type field", () => {
    const manifest: ManifestV2 = {
      version: 2,
      type: "skills",
      items: [{ type: "skill", name: "test", files: { "a": "b" } }],
    };
    expect(manifest.version).toBe(2);
    expect(manifest.type).toBe("skills");
  });

  it("StateFile has published and installed sections", () => {
    const state: StateFile = {
      version: 1,
      published: {},
      installed: {},
    };
    expect(state.version).toBe(1);
  });

  it("InstalledEntry is keyed by @user/type", () => {
    const state: StateFile = {
      version: 1,
      published: {},
      installed: {
        "@tviles/skills": {
          gistId: "abc123",
          pulledAt: "2026-03-04T12:00:00Z",
          items: [{
            type: "skill",
            name: "my-skill",
            files: { "skills/my-skill/SKILL.md": "sha256-hash" },
          }],
        },
      },
    };
    expect(state.installed["@tviles/skills"].gistId).toBe("abc123");
  });
});
