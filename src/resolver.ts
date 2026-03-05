import { listUserGists } from "./gist.js";
import type { CategoryType } from "./types.js";

const VALID_CATEGORIES = new Set<string>(["skills", "commands", "agents"]);
const DESCRIPTION_PREFIX = "skpkg:";

export type ParsedIdentifier =
  | { kind: "friendly"; username: string; category: CategoryType }
  | { kind: "user"; username: string }
  | { kind: "gistId"; gistId: string };

export interface ResolvedGist {
  gistId: string;
  source: string; // @user/type or raw gist ID
  category: CategoryType | undefined;
}

export function parseIdentifier(identifier: string): ParsedIdentifier {
  if (identifier.startsWith("@")) {
    const withoutAt = identifier.slice(1);
    const slashIndex = withoutAt.indexOf("/");

    if (slashIndex === -1) {
      return { kind: "user", username: withoutAt };
    }

    const username = withoutAt.slice(0, slashIndex);
    const category = withoutAt.slice(slashIndex + 1);

    if (!VALID_CATEGORIES.has(category)) {
      throw new Error(`Invalid category "${category}". Must be one of: skills, commands, agents`);
    }

    return { kind: "friendly", username, category: category as CategoryType };
  }

  return { kind: "gistId", gistId: identifier };
}

export function resolveIdentifier(identifier: string): ResolvedGist[] {
  const parsed = parseIdentifier(identifier);

  if (parsed.kind === "gistId") {
    return [{ gistId: parsed.gistId, source: identifier, category: undefined }];
  }

  const gists = listUserGists(parsed.username);
  const claudeShareGists = gists.filter(g =>
    g.description?.startsWith(DESCRIPTION_PREFIX)
  );

  if (parsed.kind === "friendly") {
    const match = claudeShareGists.find(
      g => g.description === `${DESCRIPTION_PREFIX}${parsed.category}`
    );
    if (!match) {
      throw new Error(`No skpkg ${parsed.category} gist found for @${parsed.username}`);
    }
    return [{ gistId: match.id, source: identifier, category: parsed.category }];
  }

  // kind === "user" — return all skpkg gists
  if (claudeShareGists.length === 0) {
    throw new Error(`No skpkg gists found for @${parsed.username}`);
  }

  return claudeShareGists.map(g => {
    const category = g.description.slice(DESCRIPTION_PREFIX.length) as CategoryType;
    return {
      gistId: g.id,
      source: `@${parsed.username}/${category}`,
      category,
    };
  });
}
