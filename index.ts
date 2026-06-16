import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import * as fs from "node:fs/promises"
import * as path from "node:path"

const getDateStr = (): string => {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

type VaultPaths = {
  vault: string
  raw: string
  pages: string
  daily: string
  assets: string
}

const resolveVaultPaths = (directory: string): VaultPaths => {
  const vault = path.join(directory, "EchoesVault")
  return {
    vault,
    raw: path.join(vault, "raw"),
    pages: path.join(vault, "pages"),
    daily: path.join(vault, "daily"),
    assets: path.join(vault, "assets"),
  }
}

const ensureVaultDirs = async (paths: VaultPaths): Promise<void> => {
  await fs.mkdir(paths.raw, { recursive: true })
  await fs.mkdir(paths.pages, { recursive: true })
  await fs.mkdir(paths.daily, { recursive: true })
  await fs.mkdir(paths.assets, { recursive: true })
}

const DEFAULT_INDEX = `# EchoesVault Index

Welcome to the EchoesVault knowledge base.

This index tracks all structured pages in the vault.
`

const sanitizeFilename = (name: string): string => {
  const cleaned = name.replace(/\.\./g, "").replace(/[\/\\]/g, "")
  return cleaned || "untitled"
}

// Normalizes any user/LLM-supplied page name to a safe `*.md` filename,
// ensuring we never produce duplicates like `foo.md.md`.
const toPageFilename = (name: string): string => {
  const safe = sanitizeFilename(name)
  return safe.endsWith(".md") ? safe : `${safe}.md`
}

const toPageSlug = (filename: string): string => filename.replace(/\.md$/, "")

const ECHOES_INIT_COMMAND = `---
description: Initialize EchoesVault — create directory structure and index.md
agent: build
---

# ROLE: EchoesVault Keeper (Knowledge Base Architect)
You are an AI developer agent equipped with persistent memory. Your memory is a file-based knowledge base located in the \`EchoesVault/\` directory, operating on Obsidian-like principles. Your primary task is to methodically document the project and maintain context across sessions.

## \ud83d\udcc2 MEMORY STRUCTURE
* \`EchoesVault/raw/\`: Raw source materials. Read-only.
* \`EchoesVault/pages/\`: The project encyclopedia. Markdown files detailing concepts, architecture, and logic.
* \`EchoesVault/daily/\`: The work log containing session summaries (YYYY-MM-DD.md).
* \`EchoesVault/assets/\`: Local storage for images, schematics, and diagrams.
* \`EchoesVault/index.md\`: The master registry. A list of all files in pages/ with a one-sentence description of each.

## \u26a0\ufe0f CORE RULES (STRICTLY ENFORCED)
1. **Read-Before-Write:** Never hallucinate file contents. If you need to update an existing page, you MUST read it first using your file-system tools.
2. **Technical Density (ADR):** Write with maximum technical density. Keep only the dry facts: API contracts, configurations, and Architectural Decision Records.
3. **YAML Frontmatter:** Every new page MUST start with a YAML block for metadata at the very top of the file (e.g., specifying type, stack, and status between triple dashes). Example:
   \`\`\`yaml
   ---
   type: architecture
   stack: [nestjs, react, kmp, esp32]
   status: active
   ---
   \`\`\`
4. **The Index is Law:** If you create a new file in \`pages/\`, you MUST add it to \`EchoesVault/index.md\`. Format the entry strictly as: \`- [[filename]]: One-sentence description.\`
5. **Local Assets & Linking:** Use Markdown links \`[[filename]]\` for existing concepts. Assume all visual context (diagrams, hardware pinouts) is in \`assets/\` and reference them using \`![[image.png]]\`.
6. **Deprecation over Deletion:** NEVER delete old documentation files. If logic becomes obsolete, prepend the file with \`> [!warning] DEPRECATED\` and link to the new relevant file.
7. **Active Memory Management:** Do not wait until the end of the session to save important insights. Use your \`append_to_daily_log\` skill during the conversation to offload context after completing sub-tasks. Use \`search_vault_pages\` if you need to read existing documentation.

## \ud83d\ude80 ACTION

The memory system has been initialized. Use your file reading tool to read the current \`EchoesVault/index.md\`. 
If the index is empty or missing, acknowledge the initialization of a fresh vault. Otherwise, acknowledge your understanding of these rules with a brief message and list the key concepts already present in the index.
`

const ECHOES_START_COMMAND = `---
description: Start a new session — restore context from EchoesVault/daily/ and EchoesVault/index.md
agent: build
---

# SYSTEM MESSAGE: Context Restoration
You are the EchoesVault Keeper. We are starting a new working session. Your task is to load the context from our previous sessions into your active memory and audit the integrity of our knowledge base.

## KEY REMINDERS
1. **Maintain technical density** (ADR style).
2. **Enforce YAML metadata** and use \`assets/\` for visual context (\`![[image.png]]\`).
3. **Use \`> [!warning] DEPRECATED\`** instead of deleting outdated files.
4. **Read-Before-Write:** Do not invent file contents.
5. **Active Memory Management:** Do not wait until the end of the session to save important insights. Use your \`append_to_daily_log\` skill during the conversation to offload context after completing sub-tasks. Use \`search_vault_pages\` if you need to read existing documentation.

## INPUT DATA
Here is the current state of our registry (\`EchoesVault/index.md\`):
<index>
!\`cat EchoesVault/index.md 2>/dev/null || echo "EchoesVault/index.md not found"\`
</index>

Here is the concatenated work log from our LAST 3 SESSIONS (\`EchoesVault/daily/...\`):
<recent_logs>
!\`if ls EchoesVault/daily/*.md >/dev/null 2>&1; then ls -1t EchoesVault/daily/*.md | head -n 3 | while read -r f; do echo "### $f"; cat "$f"; echo; echo "---"; echo; done; else echo "No daily logs found"; fi\`
</recent_logs>

## ACTION
1. **Restore:** Analyze the \`<recent_logs>\` to understand the current trajectory. Briefly summarize where we left off and what our immediate next steps should be today.
2. **Linting:** Briefly review the \`<index>\`. Do you spot any duplicate concepts, obvious contradictions, or orphan topics that should be merged? If so, propose a quick refactoring plan. If the index is clean, simply say: "Index is healthy. Ready to code."
`

const ECHOES_END_COMMAND = `---
description: End the session — save memory to EchoesVault via tool commit_memory_to_echoes_vault
agent: build
---

# SYSTEM MESSAGE: Session Distillation (Distill & Save)
Our current session is coming to an end. Your task is to crystallize the knowledge we've gained today and commit it to EchoesVault.

Adhere to the principle of technical density: we do not need a transcript of our chat. We need dry architectural facts, bug fixes, applied configurations, and explicit decisions. Remember to use \`> [!warning] DEPRECATED\` tags if we rewrote legacy logic today.

## ACTION
You MUST invoke the system skill \`commit_memory_to_echoes_vault\`.

Prepare the following payload for the skill:
* **\`dailySummary\`**: A dense technical summary to WRAP UP the session. Acknowledge that intermediate notes may already exist in today's log. Focus this summary strictly on final outcomes, unresolved blockers, and clear next steps for the next session. This will be appended to the bottom of today's log.
* **\`newPages\`**: If we discussed new global concepts or made architectural decisions, formulate them as separate Markdown articles.
* **\`indexAppends\`**: New lines to append to the end of \`EchoesVault/index.md\` (e.g. \`- [[new-page]]: Description of the concept.\`). The plugin will handle the insertion \u2014 you do not need to reproduce the full index.
* **\`indexUpdates\`**: Array of \`{ oldLine, newLine }\` to find and replace specific lines in place within the index (e.g. deprecation updates).

Compile these data points and execute the save function immediately!
`

const APPEND_TO_DAILY_LOG_SKILL = `---
name: echoes_append_to_daily_log
description: Append an intermediate technical note or decision to today's daily log immediately after completing a sub-task.
---

# TOOL USAGE: echoes_append_to_daily_log
You are equipped with a scratchpad tool to manage your cognitive load. You MUST use this tool to offload important context into \`EchoesVault/daily/YYYY-MM-DD.md\`.

## \ud83c\udfaf EXACT TRIGGER CONDITIONS (WHEN TO CALL THIS TOOL)
Do NOT use this tool randomly. You MUST invoke this tool IMMEDIATELY in the current response if ANY of the following specific events occur:
1. **Task Completion:** We successfully finish a logical unit of work (e.g., a script works, a bug is verified as fixed, tests pass) BEFORE starting the next user request.
2. **Context Switch:** The user asks to change focus (e.g., "Now let's work on the frontend" after we just worked on the backend).
3. **Architectural Agreement:** We just agreed on a core rule, library choice, database schema, or API contract.
4. **Explicit User Command:** The user explicitly tells you to "take a note", "remember this", "save our progress", or "log this".

## \u26a0\ufe0f RULES
1. **Be Concise:** Write ONLY dry facts and bullet points (e.g., "Refactored AuthGuard to use JWT refresh tokens"). No conversational filler.
2. **Do Not Interrupt Flow:** Make the tool call silently or add a brief confirmation in your response like: *"Logged the AuthGuard update to the daily vault. Ready for the frontend."*
3. **No File Overwrites:** This tool ONLY appends to the end of today's file.

## \ud83d\udce5 PAYLOAD PARAMETERS
- \`logEntry\`: (String) The markdown-formatted bullet points to append.
`

const SEARCH_VAULT_PAGES_SKILL = `---
name: echoes_search_vault_pages
description: Search the EchoesVault for specific concepts, keywords, or implementation details.
---

# TOOL USAGE: echoes_search_vault_pages
You are the EchoesVault Keeper. If you encounter a concept, API, or architectural pattern in our conversation that you suspect is documented but you lack the full context, use this tool BEFORE generating code.

## \ud83c\udfaf WHEN TO USE
- The user asks to modify an existing component, but its structure is not in your current context window.
- You need to verify if an Architectural Decision Record (ADR) exists for a specific technology.
- You want to fulfill the "Read-Before-Write" core rule.

## \u26a0\ufe0f RULES
1. **Targeted Queries:** Use specific technical keywords (e.g., "AuthGuard", "esp32 pinout", "database schema") rather than natural language questions.
2. **Handle Deprecations:** If the search returns a file marked with \`> [!warning] DEPRECATED\`, look for the link to the new relevant file and read that instead.

## \ud83d\udce5 PAYLOAD PARAMETERS
- \`query\`: (String) The specific keyword or short phrase to search for across the \`pages/\` directory.
`

const CREATE_OR_UPDATE_PAGE_SKILL = `---
name: echoes_create_or_update_page
description: Atomically create a new markdown page or update an existing one in EchoesVault/pages/, automatically updating the index.
---

# TOOL USAGE: echoes_create_or_update_page
Use this tool when a new global concept has been defined or an existing component's architecture has fundamentally changed during our session. This allows you to update the encyclopedia immediately.

## \ud83c\udfaf WHEN TO USE
- We finalized a new database schema or API contract.
- A major refactoring occurred, rendering previous documentation inaccurate.
- You need to document a newly integrated library or hardware component.

## \u26a0\ufe0f RULES
1. **Strict YAML Frontmatter:** Every page MUST include a YAML metadata block at the top (type, stack, status).
2. **Index Sync:** When you create a new file, you must provide a one-sentence description for the index. The system will automatically append it to \`index.md\`.
3. **Deprecate, Don't Delete:** If you are rewriting an existing page completely because the logic changed, consider if you should instead create a new page (e.g., \`api-v2.md\`) and update the old one with a \`> [!warning] DEPRECATED\` callout via this tool.

## \ud83d\udce5 PAYLOAD PARAMETERS
- \`filename\`: (String) The exact filename without paths (e.g., \`auth-architecture.md\`).
- \`content\`: (String) The full markdown content of the page, starting with the YAML frontmatter.
- \`indexDescription\`: (String) A one-sentence description of the file. Required if this is a newly created file. Format: "- [[filename]]: description".
`

const ensureCommands = async (directory: string): Promise<void> => {
  const commands: Record<string, string> = {
    "echoes-init.md": ECHOES_INIT_COMMAND,
    "echoes-start.md": ECHOES_START_COMMAND,
    "echoes-end.md": ECHOES_END_COMMAND,
  }
  const cmdDir = path.join(directory, ".opencode", "commands")
  await fs.mkdir(cmdDir, { recursive: true })
  for (const [name, content] of Object.entries(commands)) {
    const cmdFile = path.join(cmdDir, name)
    try {
      await fs.access(cmdFile)
    } catch {
      await fs.writeFile(cmdFile, content)
    }
  }
}

const ensureSkills = async (directory: string): Promise<void> => {
  const skills: Record<string, string> = {
    "echoes-append-to-daily-log": APPEND_TO_DAILY_LOG_SKILL,
    "echoes-search-vault-pages": SEARCH_VAULT_PAGES_SKILL,
    "echoes-create-or-update-page": CREATE_OR_UPDATE_PAGE_SKILL,
  }
  for (const [name, content] of Object.entries(skills)) {
    const skillDir = path.join(directory, ".opencode", "skills", name)
    const skillFile = path.join(skillDir, "SKILL.md")
    await fs.mkdir(skillDir, { recursive: true })
    try {
      await fs.access(skillFile)
    } catch {
      await fs.writeFile(skillFile, content)
    }
  }
}

const parseCommandFrontmatter = (cmd: string): { template: string; description?: string; agent?: string } => {
  const match = cmd.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { template: cmd }
  const frontmatter: Record<string, string> = {}
  for (const line of match[1].split("\n")) {
    const [key, ...rest] = line.split(":")
    if (key && rest.length) frontmatter[key.trim()] = rest.join(":").trim()
  }
  return { template: match[2], description: frontmatter.description, agent: frontmatter.agent }
}

export const OpenCodeEchoes: Plugin = async ({ directory }) => {
  const paths = resolveVaultPaths(directory)
  const indexFile = path.join(paths.vault, "index.md")

  await ensureVaultDirs(paths)
  try {
    await fs.access(indexFile)
  } catch {
    await fs.writeFile(indexFile, DEFAULT_INDEX)
  }

  await ensureCommands(directory)
  await ensureSkills(directory)

  return {
    config: async (input) => {
      const cmds: Record<string, string> = {
        "echoes-init": ECHOES_INIT_COMMAND,
        "echoes-start": ECHOES_START_COMMAND,
        "echoes-end": ECHOES_END_COMMAND,
      }
      input.command = input.command || {}
      for (const [name, cmd] of Object.entries(cmds)) {
        const { template, description, agent } = parseCommandFrontmatter(cmd)
        input.command[name] = { template, description, agent }
      }
    },
    tool: {
      commit_memory_to_echoes_vault: tool({
        description:
          "Save session memory to EchoesVault. Writes a daily summary, creates new knowledge base pages, and updates the Vault index. Call this at session end to persist all context.",
        args: {
          dailySummary: tool.schema
            .string()
            .describe(
              "Detailed summary of the current session: what was accomplished, bugs discovered, where you stopped, and what remains to be done."
            ),
          newPages: tool.schema
            .array(
              tool.schema.object({
                filename: tool.schema
                  .string()
                  .describe("Filename without .md extension (e.g. 'architecture-decisions')"),
                content: tool.schema
                  .string()
                  .describe("Full markdown content of the knowledge base page"),
              })
            )
            .optional()
            .describe("Array of new knowledge base pages to create in EchoesVault/pages/"),
          indexAppends: tool.schema
            .array(tool.schema.string())
            .optional()
            .describe("Lines to append to the end of EchoesVault/index.md"),
          indexUpdates: tool.schema
            .array(
              tool.schema.object({
                oldLine: tool.schema
                  .string()
                  .describe("The exact line to find and replace in the index"),
                newLine: tool.schema
                  .string()
                  .describe("The replacement line"),
              })
            )
            .optional()
            .describe("Lines to find and replace in place within EchoesVault/index.md"),
        },
        async execute(args, _ctx) {
          const today = getDateStr()

          await ensureVaultDirs(paths)

          const dailyFile = path.join(paths.daily, `${today}.md`)
          const timestamp = new Date().toISOString()
          const header = `## Session — ${timestamp}\n\n`
          await fs.appendFile(dailyFile, header + args.dailySummary + "\n\n")

          let pagesCreated = 0
          if (args.newPages && args.newPages.length > 0) {
            for (const page of args.newPages) {
              const fileName = toPageFilename(page.filename)
              const pageFile = path.join(paths.pages, fileName)
              await fs.writeFile(pageFile, page.content.trim() + "\n")
              pagesCreated++
            }
          }

          const idxFile = path.join(paths.vault, "index.md")

          let indexContent = ""
          try {
            indexContent = await fs.readFile(idxFile, "utf-8")
          } catch {
            indexContent = DEFAULT_INDEX
          }

          if (args.indexUpdates && args.indexUpdates.length > 0) {
            for (const upd of args.indexUpdates) {
              if (indexContent.includes(upd.oldLine)) {
                indexContent = indexContent.replaceAll(upd.oldLine, upd.newLine)
              }
            }
          }

          if (args.indexAppends && args.indexAppends.length > 0) {
            const toAppend = args.indexAppends.join("\n")
            indexContent = indexContent.trimEnd() + "\n" + toAppend + "\n"
          }

          await fs.writeFile(idxFile, indexContent)

          return [
            `✅ Memory committed to EchoesVault.`,
            `- Daily log: EchoesVault/daily/${today}.md`,
            `- Pages created: ${pagesCreated}`,
            `- Index: updated`,
          ].join("\n")
        },
      }),
      echoes_append_to_daily_log: tool({
        description:
          "Append an intermediate technical note or decision to today's daily log without ending the session.",
        args: {
          logEntry: tool.schema
            .string()
            .describe(
              "Markdown-formatted bullet points to append. Do not include date/time — the system adds a timestamp automatically."
            ),
        },
        async execute(args, _ctx) {
          const today = getDateStr()
          await ensureVaultDirs(paths)
          const dailyFile = path.join(paths.daily, `${today}.md`)
          const timestamp = new Date().toISOString()
          const entry = `### Scratchpad — ${timestamp}\n\n${args.logEntry}\n\n`
          await fs.appendFile(dailyFile, entry)
          return `✅ Scratchpad note saved to EchoesVault/daily/${today}.md`
        },
      }),
      echoes_search_vault_pages: tool({
        description:
          "Search the EchoesVault pages/ directory for specific concepts, keywords, or implementation details.",
        args: {
          query: tool.schema
            .string()
            .describe("Specific keyword or short phrase to search for across the pages/ directory."),
        },
        async execute(args, _ctx) {
          await ensureVaultDirs(paths)
          const results: string[] = []
          try {
            const files = (await fs.readdir(paths.pages)).filter((f) =>
              f.endsWith(".md")
            )
            for (const file of files) {
              const content = await fs.readFile(
                path.join(paths.pages, file),
                "utf-8"
              )
              const lines = content.split("\n")
              for (let i = 0; i < lines.length; i++) {
                if (
                  lines[i].toLowerCase().includes(args.query.toLowerCase())
                ) {
                  results.push(
                    `${file}:${i + 1}: ${lines[i].trim().slice(0, 200)}`
                  )
                }
              }
            }
          } catch {
            return "_No pages found in EchoesVault/pages/_"
          }
          if (results.length === 0) {
            return `No results found for "${args.query}" in EchoesVault/pages/.`
          }
          return results.join("\n")
        },
      }),
      echoes_create_or_update_page: tool({
        description:
          "Atomically create a new markdown page or update an existing one in EchoesVault/pages/, automatically updating the index if the file is new.",
        args: {
          filename: tool.schema
            .string()
            .describe("Exact filename without paths (e.g. 'auth-architecture.md')."),
          content: tool.schema
            .string()
            .describe("Full markdown content of the page, starting with YAML frontmatter."),
          indexDescription: tool.schema
            .string()
            .optional()
            .describe("One-sentence description for the index. Required for new files. Format: '- [[filename]]: description'."),
        },
        async execute(args, _ctx) {
          await ensureVaultDirs(paths)
          const fileName = toPageFilename(args.filename)
          const pageFile = path.join(paths.pages, fileName)

          const existed = await fs.access(pageFile).then(() => true).catch(() => false)
          await fs.writeFile(pageFile, args.content.trim() + "\n")

          if (!existed && args.indexDescription) {
            const idxFile = path.join(paths.vault, "index.md")
            let indexContent = ""
            try {
              indexContent = await fs.readFile(idxFile, "utf-8")
            } catch {
              indexContent = DEFAULT_INDEX
            }
            const link = `[[${toPageSlug(fileName)}]]`
            if (!indexContent.includes(link)) {
              indexContent = indexContent.trimEnd() + "\n" + args.indexDescription + "\n"
              await fs.writeFile(idxFile, indexContent)
            }
          }

          const action = existed ? "updated" : "created"
          const parts = [`✅ Page ${action}: EchoesVault/pages/${fileName}`]
          if (!existed && args.indexDescription) {
            parts.push(`📑 Index: synced`)
          }
          return parts.join("\n")
        },
      }),
    },
  }
}

export default OpenCodeEchoes
export { OpenCodeEchoes as server }
