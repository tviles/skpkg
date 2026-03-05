import { execSync } from "node:child_process";

export class GistNotFoundError extends Error {
  constructor(gistId: string) {
    super(`Gist "${gistId}" not found (may have been deleted)`);
    this.name = "GistNotFoundError";
  }
}

function isNotFound(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes("404");
}

export function validateGhCli(): void {
  try {
    execSync("gh --version", { stdio: "pipe" });
  } catch {
    console.error("Error: GitHub CLI (gh) is not installed.");
    console.error("Install it: https://cli.github.com/");
    process.exit(1);
  }

  try {
    execSync("gh auth status", { stdio: "pipe" });
  } catch {
    console.error("Error: GitHub CLI is not authenticated.");
    console.error("Run: gh auth login");
    process.exit(1);
  }
}

export interface GistListItem {
  id: string;
  description: string;
  files: Record<string, { content?: string }>;
}

export function getGhUsername(): string {
  try {
    const result = execSync("gh api /user --jq .login", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return result.trim();
  } catch {
    return "your-username";
  }
}

export function createGist(files: Record<string, string>, isPublic: boolean = false, description: string = "Claude Code shared items (skpkg)"): string {
  const body = {
    description,
    public: isPublic,
    files: Object.fromEntries(
      Object.entries(files).map(([name, content]) => [name, { content }])
    ),
  };

  try {
    const result = execSync("gh api --method POST /gists --input -", {
      input: JSON.stringify(body),
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    const parsed = JSON.parse(result);
    return parsed.id;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error creating gist: ${message}`);
    process.exit(1);
  }
}

export function fetchGist(gistId: string): Record<string, string> {
  try {
    const result = execSync(`gh api /gists/${encodeURIComponent(gistId)}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    const parsed = JSON.parse(result);
    const files: Record<string, string> = {};

    for (const [name, file] of Object.entries(parsed.files)) {
      files[name] = (file as { content: string }).content;
    }

    return files;
  } catch (err: unknown) {
    if (isNotFound(err)) {
      throw new GistNotFoundError(gistId);
    }
    throw err;
  }
}

export function updateGist(gistId: string, files: Record<string, string>, description?: string): void {
  const body: Record<string, unknown> = {
    files: Object.fromEntries(
      Object.entries(files).map(([name, content]) => [name, { content }])
    ),
  };
  if (description) body.description = description;

  try {
    execSync(`gh api --method PATCH /gists/${encodeURIComponent(gistId)} --input -`, {
      input: JSON.stringify(body),
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (err: unknown) {
    if (isNotFound(err)) {
      throw new GistNotFoundError(gistId);
    }
    throw err;
  }
}

export function listUserGists(username: string): GistListItem[] {
  try {
    const result = execSync(`gh api /users/${encodeURIComponent(username)}/gists --paginate`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return JSON.parse(result) as GistListItem[];
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error listing gists for "${username}": ${message}`);
    process.exit(1);
  }
}

export function deleteGist(gistId: string): void {
  try {
    execSync(`gh api --method DELETE /gists/${encodeURIComponent(gistId)}`, {
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (err: unknown) {
    if (isNotFound(err)) {
      throw new GistNotFoundError(gistId);
    }
    throw err;
  }
}
