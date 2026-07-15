---
name: echoes_create_or_update_page
description: Atomically create a new markdown page or update an existing one in EchoesVault/pages/, automatically updating the index.
---

# TOOL USAGE: echoes_create_or_update_page
Use this tool when a new global concept has been defined or an existing component's architecture has fundamentally changed during our session. This allows you to update the encyclopedia immediately.

## 🎯 WHEN TO USE
- We finalized a new database schema or API contract.
- A major refactoring occurred, rendering previous documentation inaccurate.
- You need to document a newly integrated library or hardware component.

## ⚠️ RULES
1. **Strict YAML Frontmatter:** Every page MUST include a YAML metadata block at the top (type, stack, status).
2. **Index Sync:** When you create a new file, you must provide a one-sentence description for the index. The system will automatically append it to `index.md`.
3. **Deprecate, Don't Delete:** If you are rewriting an existing page completely because the logic changed, consider if you should instead create a new page (e.g., `api-v2.md`) and update the old one with a `> [!warning] DEPRECATED` callout via this tool.

## 📥 PAYLOAD PARAMETERS
- `filename`: (String) The exact filename without paths (e.g., `auth-architecture.md`).
- `content`: (String) The full markdown content of the page, starting with the YAML frontmatter.
- `indexDescription`: (String) A one-sentence description of the file. Required if this is a newly created file. Format: "- [[filename]]: description".
