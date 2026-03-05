import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/gist.js", () => ({
  listUserGists: vi.fn(),
}));

import { listUserGists } from "../src/gist.js";
import { resolveIdentifier, parseIdentifier } from "../src/resolver.js";

const mockedListUserGists = vi.mocked(listUserGists);

describe("parseIdentifier", () => {
  it("parses @user/type format", () => {
    const result = parseIdentifier("@tviles/skills");
    expect(result).toEqual({ kind: "friendly", username: "tviles", category: "skills" });
  });

  it("parses @user format (all types)", () => {
    const result = parseIdentifier("@tviles");
    expect(result).toEqual({ kind: "user", username: "tviles" });
  });

  it("parses raw gist ID", () => {
    const result = parseIdentifier("abc123def456");
    expect(result).toEqual({ kind: "gistId", gistId: "abc123def456" });
  });

  it("rejects invalid @user/type with bad category", () => {
    expect(() => parseIdentifier("@tviles/invalid")).toThrow();
  });
});

describe("resolveIdentifier", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves @user/type by finding matching gist description", () => {
    mockedListUserGists.mockReturnValue([
      { id: "g1", description: "skpkg:skills", files: {} },
      { id: "g2", description: "skpkg:commands", files: {} },
    ]);

    const result = resolveIdentifier("@tviles/skills");
    expect(result).toEqual([{ gistId: "g1", source: "@tviles/skills", category: "skills" }]);
  });

  it("resolves @user by returning all skpkg gists", () => {
    mockedListUserGists.mockReturnValue([
      { id: "g1", description: "skpkg:skills", files: {} },
      { id: "g2", description: "skpkg:commands", files: {} },
      { id: "g3", description: "unrelated gist", files: {} },
    ]);

    const result = resolveIdentifier("@tviles");
    expect(result).toHaveLength(2);
    expect(result.map(r => r.category).sort()).toEqual(["commands", "skills"]);
  });

  it("resolves raw gist ID directly", () => {
    const result = resolveIdentifier("abc123");
    expect(result).toEqual([{ gistId: "abc123", source: "abc123", category: undefined }]);
  });

  it("throws when @user/type gist not found", () => {
    mockedListUserGists.mockReturnValue([
      { id: "g1", description: "other gist", files: {} },
    ]);

    expect(() => resolveIdentifier("@tviles/skills")).toThrow();
  });

  it("throws when @user has no skpkg gists", () => {
    mockedListUserGists.mockReturnValue([
      { id: "g1", description: "other gist", files: {} },
    ]);

    expect(() => resolveIdentifier("@tviles")).toThrow();
  });
});
