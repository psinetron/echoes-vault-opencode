<div align="center">
  <img src="https://raw.githubusercontent.com/psinetron/echoes-vault-opencode/main/images/EchoesVault.png" alt="EchoesVault" width="200" />
  <h1>EchoesVault</h1>
  <p>Persistent memory plugin for OpenCode. Obsidian-style knowledge base that survives across sessions.</p>

  [![npm version](https://img.shields.io/npm/v/echoes-vault-opencode.svg)](https://www.npmjs.com/package/echoes-vault-opencode)
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
  [![OpenCode](https://img.shields.io/badge/OpenCode-plugin-blueviolet)](https://opencode.ai/docs/ecosystem)
</div>

---

AI agents forget everything when a session ends. EchoesVault gives OpenCode a persistent, file-based memory: architectural decisions, daily work logs, and a searchable project encyclopedia — all stored as plain Markdown in your repository.

## Features

- **Google OKF Compliant** — EchoesVault uses Google's [Open Knowledge Format (OKF)](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf) under the hood. Your knowledge base is 100% interoperable with standard AI parsers and renders natively on GitHub and GitLab.
- **Zero context loss** — start every session exactly where you left off. `/echoes-start` reads the last 3 daily logs and the full knowledge index and feeds them to the AI automatically.
- **Zero setup** — on first load the plugin creates the entire vault structure, slash commands, and agent skills by itself. Nothing to configure.
- **Obsidian-compatible vault** — `EchoesVault/` is a valid Obsidian vault. Open it in Obsidian at any time for visual navigation, graph view, and search.
- **ADR-style documentation** — the AI is instructed to write with maximum technical density: API contracts, configuration records, and Architectural Decision Records — not chat transcripts.
- **Active memory management** — the AI logs intermediate notes mid-session via `echoes_append_to_daily_log`, not just at the end. Context is never lost to a crash or accidental close.
- **Deprecation over deletion** — outdated pages are marked `> [!warning] DEPRECATED` and linked to their replacement. The full history is always preserved.
- **Safe and idempotent** — commands and skills are only created if they don't exist. Restarting OpenCode never overwrites user edits.

## Vault structure

The plugin creates and manages the following directory inside your project:

```
EchoesVault/
├── index.md      — master registry: one-line description of every page
├── pages/        — project encyclopedia (Markdown, YAML frontmatter, [[wikilinks]])
├── daily/        — session work logs (YYYY-MM-DD.md)
├── assets/       — diagrams, schematics, hardware pinouts
└── raw/          — read-only source materials
```

Every page in `pages/` starts with YAML frontmatter. The `type` property is strictly enforced to maintain OKF compliance:

```yaml
---
type: architecture
stack: [nestjs, react]
status: active
---
```

## Requirements

- [OpenCode](https://opencode.ai) `>= 1.16.0`

## Installation

### Via OpenCode UI (recommended)

1. Press <kbd>control</kbd> + <kbd>P</kbd> to open the command palette
2. Select **Install plugin**
3. Enter the package name: `echoes-vault-opencode`
4. Restart OpenCode

### Manual

Add the plugin to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["echoes-vault-opencode"]
}
```

OpenCode installs the package automatically via Bun on next startup. On first run the plugin bootstraps the vault, registers the slash commands, and installs the agent skills — no manual steps required.

## Usage

### Typical session workflow

**1. First time in a project — initialize the vault:**
```
/echoes-init
```
The AI reads `EchoesVault/index.md`, acknowledges the rules, and lists any existing knowledge. On a fresh vault it confirms initialization.

**2. Start of every subsequent session — restore context:**
```
/echoes-start
```
Reads the last 3 daily logs and the full index, then summarizes where you left off and what the immediate next steps are. Also lints the index for duplicates or contradictions.

**3. Work normally.** During the session the AI uses the vault tools autonomously:
- logs intermediate decisions to the daily scratchpad,
- searches existing pages before writing new code,
- creates or updates encyclopedia pages when architecture changes.

**4. End of session — save everything:**
```
/echoes-end
```
The AI distills the session into a dense technical summary, writes new encyclopedia pages for any concepts decided today, and updates the index. All via a single tool call.

---

### Slash commands reference

| Command | Description |
|---|---|
| `/echoes-init` | Initialize the vault and brief the AI on the knowledge base rules |
| `/echoes-start` | Start session — restore context from the last 3 daily logs and the index |
| `/echoes-end` | End session — distill and commit session memory to the vault |
| `/echoes-status` | Report vault health, statistics, and scalability |

### AI tools reference

These tools are available to the AI during any session.

| Tool | Description |
|---|---|
| `commit_memory_to_echoes_vault` | Save a daily summary, create new pages, and update the index in one atomic call |
| `echoes_append_to_daily_log` | Append a timestamped note to today's daily log mid-session |
| `echoes_search_vault_pages` | Search `pages/` by keyword and return matching lines with file and line number |
| `echoes_create_or_update_page` | Atomically create or overwrite a page in `pages/`, auto-syncing the index |

### Agent skills reference

Skills guide the AI on *when* and *how* to use the tools above. They are loaded on-demand via the OpenCode `skill` tool.

| Skill | Description |
|---|---|
| `echoes_append_to_daily_log` | Exact trigger conditions and rules for mid-session logging |
| `echoes_search_vault_pages` | When to search the vault before generating code |
| `echoes_create_or_update_page` | When to create vs. update a page, deprecation rules |

## Updating

Check the current version in the badge at the top of this page, then run:

```
opencode plugin echoes-vault-opencode@X.X.X --force
```

Replace `X.X.X` with the latest version from the [npm page](https://www.npmjs.com/package/echoes-vault-opencode?activeTab=versions). The `--force` flag is required to overwrite the cached version.

After updating, restart OpenCode to apply the changes.

## Support the project

EchoesVault is built on top of [OpenCode](https://opencode.ai/go?ref=EZW07YHVTG). If you find this plugin useful, consider subscribing to **OpenCode GO** — it unlocks unlimited usage and directly funds the platform this plugin depends on. There's a 50% discount available via [this link](https://opencode.ai/go?ref=EZW07YHVTG).

## License

[MIT](LICENSE)
