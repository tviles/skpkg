import { describe, it, expect, vi, beforeEach } from "vitest";
import * as child_process from "node:child_process";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

const mockedExecSync = vi.mocked(child_process.execSync);

// Must import after mock setup
const { validateGhCli, createGist, fetchGist, deleteGist, updateGist, listUserGists, getGhUsername, GistNotFoundError } = await import("../src/gist.js");

describe("gist client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Prevent process.exit from actually exiting
    vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as never);
  });

  describe("validateGhCli", () => {
    it("succeeds when gh is installed and authenticated", () => {
      mockedExecSync.mockReturnValue(Buffer.from(""));
      expect(() => validateGhCli()).not.toThrow();
    });

    it("exits when gh is not installed", () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error("not found");
      });
      expect(() => validateGhCli()).toThrow("process.exit called");
    });
  });

  describe("createGist", () => {
    it("creates a gist and returns the ID", () => {
      mockedExecSync.mockReturnValue(JSON.stringify({ id: "abc123" }));

      const id = createGist({ "test.md": "content" });
      expect(id).toBe("abc123");

      const call = mockedExecSync.mock.calls[0];
      expect(call[0]).toBe("gh api --method POST /gists --input -");
      const input = JSON.parse((call[1] as { input: string }).input);
      expect(input.public).toBe(false);
      expect(input.files["test.md"].content).toBe("content");
    });

    it("creates a public gist when specified", () => {
      mockedExecSync.mockReturnValue(JSON.stringify({ id: "abc123" }));
      createGist({ "test.md": "content" }, true);

      const input = JSON.parse((mockedExecSync.mock.calls[0][1] as { input: string }).input);
      expect(input.public).toBe(true);
    });

    it("exits on failure", () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error("network error");
      });
      expect(() => createGist({ "test.md": "content" })).toThrow("process.exit called");
    });
  });

  describe("fetchGist", () => {
    it("fetches gist files", () => {
      mockedExecSync.mockReturnValue(JSON.stringify({
        files: {
          "test.md": { content: "hello" },
          "manifest.json": { content: '{"version":1}' },
        },
      }));

      const files = fetchGist("abc123");
      expect(files["test.md"]).toBe("hello");
      expect(files["manifest.json"]).toBe('{"version":1}');
    });

    it("throws GistNotFoundError on 404", () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error("HTTP 404");
      });
      expect(() => fetchGist("invalid")).toThrow(GistNotFoundError);
    });

    it("throws generic error on non-404 failure", () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error("HTTP 500");
      });
      expect(() => fetchGist("invalid")).toThrow("HTTP 500");
      expect(() => fetchGist("invalid")).not.toThrow(GistNotFoundError);
    });
  });

  describe("deleteGist", () => {
    it("calls gh api DELETE with the gist ID", () => {
      mockedExecSync.mockReturnValue(Buffer.from(""));
      deleteGist("abc123");

      expect(mockedExecSync).toHaveBeenCalledWith(
        "gh api --method DELETE /gists/abc123",
        { stdio: ["pipe", "pipe", "pipe"] }
      );
    });

    it("throws GistNotFoundError on 404", () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error("HTTP 404");
      });
      expect(() => deleteGist("invalid-id")).toThrow(GistNotFoundError);
    });

    it("throws generic error on non-404 failure", () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error("HTTP 500");
      });
      expect(() => deleteGist("invalid-id")).toThrow("HTTP 500");
      expect(() => deleteGist("invalid-id")).not.toThrow(GistNotFoundError);
    });

    it("URL-encodes the gist ID", () => {
      mockedExecSync.mockReturnValue(Buffer.from(""));
      deleteGist("abc/123");

      expect(mockedExecSync).toHaveBeenCalledWith(
        "gh api --method DELETE /gists/abc%2F123",
        { stdio: ["pipe", "pipe", "pipe"] }
      );
    });
  });

  describe("updateGist", () => {
    it("calls gh api PATCH with the gist ID and files", () => {
      mockedExecSync.mockReturnValue(JSON.stringify({ id: "abc123" }));
      updateGist("abc123", { "test.md": "updated" }, "skpkg:skills");

      const call = mockedExecSync.mock.calls[0];
      expect(call[0]).toBe("gh api --method PATCH /gists/abc123 --input -");
      const input = JSON.parse((call[1] as { input: string }).input);
      expect(input.files["test.md"].content).toBe("updated");
      expect(input.description).toBe("skpkg:skills");
    });

    it("throws GistNotFoundError on 404", () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error("HTTP 404");
      });
      expect(() => updateGist("abc123", {})).toThrow(GistNotFoundError);
    });

    it("throws generic error on non-404 failure", () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error("HTTP 500");
      });
      expect(() => updateGist("abc123", {})).toThrow("HTTP 500");
      expect(() => updateGist("abc123", {})).not.toThrow(GistNotFoundError);
    });
  });

  describe("listUserGists", () => {
    it("returns parsed gist list", () => {
      mockedExecSync.mockReturnValue(JSON.stringify([
        { id: "g1", description: "skpkg:skills", files: {} },
        { id: "g2", description: "other gist", files: {} },
      ]));

      const gists = listUserGists("tviles");
      expect(gists).toHaveLength(2);
      expect(gists[0].id).toBe("g1");
    });

    it("exits on failure", () => {
      mockedExecSync.mockImplementation(() => { throw new Error("fail"); });
      expect(() => listUserGists("tviles")).toThrow("process.exit called");
    });
  });

  describe("getGhUsername", () => {
    it("returns trimmed username", () => {
      mockedExecSync.mockReturnValue("tviles\n");
      expect(getGhUsername()).toBe("tviles");
    });

    it("returns fallback on failure", () => {
      mockedExecSync.mockImplementation(() => { throw new Error("fail"); });
      expect(getGhUsername()).toBe("your-username");
    });
  });
});
