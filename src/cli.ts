#!/usr/bin/env node

import { Command } from "commander";
import { confirm } from "@inquirer/prompts";
import { scan } from "./scanner.js";
import { pickItems } from "./picker.js";
import { bundle } from "./bundler.js";
import { validateGhCli, createGist, fetchGist, deleteGist, updateGist, getGhUsername, GistNotFoundError } from "./gist.js";
import { pull } from "./puller.js";
import { loadState, saveState, hashContent } from "./state.js";
import { resolveIdentifier } from "./resolver.js";
import { mergeGistFiles } from "./merger.js";
import { promptOverwrite } from "./prompter.js";
import type { CategoryType } from "./types.js";
import * as path from "node:path";

const program = new Command();

function getClaudeDir(): string {
  return path.join(process.env.HOME ?? "~", ".claude");
}

function timeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

program
  .name("skpkg")
  .description("Share Claude Code skills, commands, and agents via GitHub Gists")
  .version("2.0.0");

program
  .command("push")
  .description("Share skills, commands, or agents as a GitHub Gist")
  .option("--name <type>", "Type to push: skills, commands, or agents")
  .option("--select", "Cherry-pick specific items to include", false)
  .option("--secret", "Create a secret gist (default: public)", false)
  .action(async (options: { name?: string; select: boolean; secret: boolean }) => {
    validateGhCli();

    const claudeDir = getClaudeDir();

    const validNames = ["skills", "commands", "agents"] as const;
    if (options.name && !validNames.includes(options.name as any)) {
      console.error(`Error: --name must be one of: ${validNames.join(", ")}`);
      process.exit(1);
    }

    const categories: CategoryType[] = options.name
      ? [options.name as CategoryType]
      : [...validNames];

    const state = loadState(claudeDir);
    let anyPushed = false;

    for (const category of categories) {
      let items = scan(claudeDir, category);

      if (items.length === 0) {
        if (options.name) {
          console.log(`No ${category} found in ~/.claude/`);
        }
        continue;
      }

      if (options.select) {
        items = await pickItems(items);
        if (items.length === 0) {
          console.log(`No ${category} selected.`);
          continue;
        }
      }

      console.log("");
      console.log(`${category} to share:`);
      for (const item of items) {
        console.log(`  ${item.name}`);
      }

      const files = bundle(items, claudeDir, category);
      const description = `skpkg:${category}`;
      const existing = state.published[category];

      if (existing) {
        try {
          if (options.select) {
            // Additive merge: fetch existing gist, detect conflicts, prompt, merge
            console.log(`Fetching existing ${category} gist...`);
            const existingFiles = fetchGist(existing.gistId);

            // Parse existing manifest to find item names
            let existingItemNames = new Set<string>();
            if (existingFiles["manifest.json"]) {
              try {
                const existingManifest = JSON.parse(existingFiles["manifest.json"]);
                existingItemNames = new Set((existingManifest.items ?? []).map((i: any) => i.name));
              } catch {}
            }

            // Determine which new items are accepted (prompt for conflicts)
            const newItemNames = items.map(i => i.name);
            const acceptedNames = await promptOverwrite(newItemNames, existingItemNames);

            if (acceptedNames.length === 0) {
              console.log("No changes to push.");
              continue;
            }

            // Merge and update
            const mergedFiles = mergeGistFiles(existingFiles, files, acceptedNames, category);
            console.log(`Updating ${category} gist...`);
            updateGist(existing.gistId, mergedFiles, description);
          } else {
            // Full replacement (existing behavior)
            console.log(`Updating existing ${category} gist...`);
            updateGist(existing.gistId, files, description);
          }
          existing.updatedAt = new Date().toISOString();
        } catch (err) {
          if (err instanceof GistNotFoundError) {
            console.log(`Previously published ${category} gist no longer exists.`);
            const shouldCreate = await confirm({ message: `Create a new ${category} gist?` });
            if (!shouldCreate) {
              console.log("Skipped.");
              continue;
            }
            delete state.published[category];
            const gistId = createGist(files, !options.secret, description);
            state.published[category] = {
              gistId,
              public: !options.secret,
              updatedAt: new Date().toISOString(),
            };
          } else {
            throw err;
          }
        }
      } else {
        console.log(`Creating new ${category} gist...`);
        const gistId = createGist(files, !options.secret, description);
        state.published[category] = {
          gistId,
          public: !options.secret,
          updatedAt: new Date().toISOString(),
        };
      }

      saveState(claudeDir, state);
      anyPushed = true;
    }

    if (anyPushed) {
      console.log("");
      console.log("Done! Others can install with:");
      const username = getGhUsername();
      for (const category of categories) {
        if (state.published[category]) {
          console.log(`  npx skpkg pull @${username}/${category}`);
        }
      }
    } else if (!options.name) {
      console.log("No skills, commands, or agents found in ~/.claude/");
    }
  });

program
  .command("pull")
  .description("Install shared items from a GitHub Gist")
  .argument("<identifier>", "Gist ID or @username/type (e.g. @tviles/skills)")
  .action(async (identifier: string) => {
    validateGhCli();

    const claudeDir = getClaudeDir();
    const resolved = resolveIdentifier(identifier);

    for (const { gistId, source, category } of resolved) {
      console.log(`Fetching ${source}...`);
      const gistFiles = fetchGist(gistId);
      const pulled = await pull(gistFiles, claudeDir);

      const state = loadState(claudeDir);
      state.installed[source] = {
        gistId,
        pulledAt: new Date().toISOString(),
        items: pulled.map(p => ({
          type: p.type as any,
          name: p.name,
          files: Object.fromEntries(
            Object.entries(p.fileContents).map(([filePath, content]) => [filePath, hashContent(content)])
          ),
        })),
      };
      saveState(claudeDir, state);
    }

    console.log("");
    console.log("Done!");
  });

program
  .command("status")
  .description("Check for updates to installed items")
  .action(async () => {
    validateGhCli();

    const claudeDir = getClaudeDir();
    const state = loadState(claudeDir);

    const entries = Object.entries(state.installed);
    if (entries.length === 0) {
      console.log("No installed items. Use `skpkg pull` to install some.");
      return;
    }

    for (const [source, entry] of entries) {
      try {
        const remoteFiles = fetchGist(entry.gistId);
        const manifest = JSON.parse(remoteFiles["manifest.json"]);

        let changed = 0;
        for (const item of manifest.items) {
          for (const [origPath, gistFilename] of Object.entries(item.files)) {
            const remoteContent = remoteFiles[gistFilename as string];
            if (!remoteContent) continue;

            const remoteHash = hashContent(remoteContent);
            const localItem = entry.items.find((i: any) => i.name === item.name);
            const localHash = localItem?.files[origPath];

            if (localHash && localHash !== remoteHash) changed++;
          }
        }

        const age = timeSince(new Date(entry.pulledAt));
        if (changed > 0) {
          console.log(`${source}  ⚡ ${changed} file(s) changed  (pulled ${age})`);
        } else {
          console.log(`${source}  ✓ up to date  (pulled ${age})`);
        }
      } catch (err) {
        if (err instanceof GistNotFoundError) {
          console.log(`${source}  ✗ gist deleted  (pulled ${timeSince(new Date(entry.pulledAt))})`);
        } else {
          console.log(`${source}  ✗ gist unavailable  (pulled ${timeSince(new Date(entry.pulledAt))})`);
        }
      }
    }
  });

program
  .command("update")
  .description("Update installed items")
  .argument("[identifier]", "Specific @user/type to update, or omit for --all")
  .option("--all", "Update all installed items", false)
  .action(async (identifier: string | undefined, options: { all: boolean }) => {
    validateGhCli();

    const claudeDir = getClaudeDir();
    const state = loadState(claudeDir);

    let toUpdate: [string, typeof state.installed[string]][];

    if (identifier) {
      const entry = state.installed[identifier];
      if (!entry) {
        console.error(`"${identifier}" is not installed. Run \`skpkg list\` to see installed items.`);
        process.exit(1);
      }
      toUpdate = [[identifier, entry]];
    } else if (options.all) {
      toUpdate = Object.entries(state.installed);
    } else {
      console.error("Specify an identifier or use --all.");
      process.exit(1);
    }

    if (toUpdate.length === 0) {
      console.log("Nothing to update.");
      return;
    }

    for (const [source, entry] of toUpdate) {
      try {
        console.log(`Checking ${source}...`);
        const gistFiles = fetchGist(entry.gistId);
        const pulled = await pull(gistFiles, claudeDir);

        state.installed[source] = {
          gistId: entry.gistId,
          pulledAt: new Date().toISOString(),
          items: pulled.map(p => ({
            type: p.type as any,
            name: p.name,
            files: Object.fromEntries(
              Object.entries(p.fileContents).map(([filePath, content]) => [filePath, hashContent(content)])
            ),
          })),
        };
      } catch (err) {
        if (err instanceof GistNotFoundError) {
          console.log(`The gist for ${source} no longer exists.`);
          const shouldRemove = await confirm({ message: `Remove ${source} from installed items?` });
          if (shouldRemove) {
            delete state.installed[source];
            console.log(`Removed ${source}.`);
          }
        } else {
          console.error(`Failed to update ${source}`);
        }
      }
    }

    saveState(claudeDir, state);
    console.log("");
    console.log("Updated!");
  });

program
  .command("list")
  .description("Show published and installed items")
  .action(() => {
    const claudeDir = getClaudeDir();
    const state = loadState(claudeDir);

    const publishedEntries = Object.entries(state.published);
    const installedEntries = Object.entries(state.installed);

    if (publishedEntries.length === 0 && installedEntries.length === 0) {
      console.log("Nothing published or installed yet.");
      console.log("");
      console.log("  Push: npx skpkg push --name skills");
      console.log("  Pull: npx skpkg pull @username/skills");
      return;
    }

    if (publishedEntries.length > 0) {
      console.log("Published:");
      for (const [category, entry] of publishedEntries) {
        const visibility = entry.public ? "public" : "secret";
        const age = timeSince(new Date(entry.updatedAt));
        console.log(`  ${category}  → gist ${entry.gistId.slice(0, 8)}… (${visibility})  updated ${age}`);
      }
      console.log("");
    }

    if (installedEntries.length > 0) {
      console.log("Installed:");
      for (const [source, entry] of installedEntries) {
        const count = entry.items.length;
        const age = timeSince(new Date(entry.pulledAt));
        console.log(`  ${source}  ${count} item(s)  pulled ${age}`);
      }
    }
  });

program
  .command("delete")
  .description("Delete a shared gist")
  .argument("[gist-id]", "The gist ID to delete")
  .option("--name <type>", "Delete published gist by type: skills, commands, or agents")
  .action(async (gistId: string | undefined, options: { name?: string }) => {
    validateGhCli();

    if (options.name) {
      const validNames = ["skills", "commands", "agents"];
      if (!validNames.includes(options.name)) {
        console.error(`Error: --name must be one of: ${validNames.join(", ")}`);
        process.exit(1);
      }

      const claudeDir = getClaudeDir();
      const state = loadState(claudeDir);
      const entry = state.published[options.name as CategoryType];

      if (!entry) {
        console.error(`No published ${options.name} gist found.`);
        process.exit(1);
      }

      const confirmed = await confirm({ message: `Delete your published ${options.name} gist?` });
      if (!confirmed) {
        console.log("Cancelled.");
        return;
      }

      try {
        deleteGist(entry.gistId);
      } catch (err) {
        if (err instanceof GistNotFoundError) {
          console.log(`Gist was already deleted on GitHub.`);
          const shouldClean = await confirm({ message: `Clean up local state for ${options.name}?` });
          if (!shouldClean) {
            console.log("Cancelled.");
            return;
          }
        } else {
          throw err;
        }
      }
      delete state.published[options.name as CategoryType];
      saveState(claudeDir, state);
      console.log(`Deleted ${options.name} gist.`);
    } else if (gistId) {
      try {
        deleteGist(gistId);
      } catch (err) {
        if (err instanceof GistNotFoundError) {
          console.log("Gist was already deleted on GitHub.");
          return;
        }
        throw err;
      }
      console.log("Gist deleted.");
    } else {
      console.error("Provide a gist ID or use --name.");
      process.exit(1);
    }
  });

program.parse();
