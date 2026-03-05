# skpkg

Share Claude Code skills, commands, and agents with others via GitHub Gists.

## What it does

`skpkg` bundles your local Claude Code customizations (skills, commands, and agents from `~/.claude/`) into GitHub Gists. Share a simple `@user/type` identifier with others so they can install your items with one command.

## Prerequisites

- Node.js >= 18
- [GitHub CLI](https://cli.github.com/) installed and authenticated (`gh auth login`)

## Usage

### Push

```sh
npx skpkg push [--name skills|commands|agents] [--select] [--public]
```

Scans `~/.claude/` for items and publishes them as a GitHub Gist.

- `--name` — limit to a specific type (skills, commands, or agents)
- `--select` — cherry-pick individual items to include
- `--public` — create a public gist (default: secret)

### Pull

```sh
npx skpkg pull <@user/type | gist-id>
```

Installs shared items into your `~/.claude/` directory. Accepts an `@user/type` identifier or a raw gist ID.

### Status

```sh
npx skpkg status
```

Checks installed items against their remote gists and reports which have updates available.

### Update

```sh
npx skpkg update [identifier] [--all]
```

Re-pulls the latest version of installed items.

- Pass a specific `@user/type` to update one source
- Use `--all` to update everything

### List

```sh
npx skpkg list
```

Shows all published and installed items with their gist IDs and timestamps.

### Delete

```sh
npx skpkg delete [gist-id] [--name skills|commands|agents]
```

Deletes a shared gist. Use `--name` to delete your published gist by type, or pass a gist ID directly.

## Identifiers

The `@user/type` format (e.g. `@tviles/skills`) resolves to a user's published gist for that type. This is the recommended way to share and install items.

## Supported item types

| Type     | Location                             |
|----------|--------------------------------------|
| Skills   | `~/.claude/skills/<name>/SKILL.md`   |
| Commands | `~/.claude/commands/<name>.md`       |
| Agents   | `~/.claude/agents/<name>.md`         |

Items must have valid YAML frontmatter with `name` and/or `description` fields to be detected.

## License

MIT
