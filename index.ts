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

type VaultStats = {
  totalPages: number
  totalDailyLogs: number
  deprecatedPages: number
}

type EchoesState = {
  version: number
  pluginVersion: string
  initialized: boolean
  session: {
    started: boolean
    saved: boolean
    lastStart: string | null
    lastSave: string | null
  }
  stats: VaultStats
}

const STATE_FILENAME = ".opencode/echoes-state.json"

const getPluginVersion = async (): Promise<string> => {
  try {
    const pkgPath = path.join(path.dirname(new URL(import.meta.url).pathname), "package.json")
    const pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8"))
    return pkg.version || "0.0.0"
  } catch {
    return "0.0.0"
  }
}

const defaultState = (): EchoesState => ({
  version: 1,
  pluginVersion: "0.0.0",
  initialized: false,
  session: {
    started: false,
    saved: false,
    lastStart: null,
    lastSave: null,
  },
  stats: {
    totalPages: 0,
    totalDailyLogs: 0,
    deprecatedPages: 0,
  },
})

const readState = async (directory: string): Promise<EchoesState> => {
  try {
    const raw = await fs.readFile(path.join(directory, STATE_FILENAME), "utf-8")
    return JSON.parse(raw) as EchoesState
  } catch {
    return defaultState()
  }
}

const writeState = async (directory: string, state: EchoesState): Promise<void> => {
  const filePath = path.join(directory, STATE_FILENAME)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(state, null, 2))
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

const collectStats = async (vaultPaths: VaultPaths): Promise<VaultStats> => {
  let totalPages = 0
  let totalDailyLogs = 0
  let deprecatedPages = 0

  try {
    const pageFiles = (await fs.readdir(vaultPaths.pages)).filter((f) => f.endsWith(".md"))
    totalPages = pageFiles.length
    for (const file of pageFiles) {
      const content = await fs.readFile(path.join(vaultPaths.pages, file), "utf-8")
      if (content.includes("DEPRECATED")) {
        deprecatedPages++
      }
    }
  } catch { /* pages dir may not exist yet */ }

  try {
    const dailyFiles = (await fs.readdir(vaultPaths.daily)).filter((f) => f.endsWith(".md"))
    totalDailyLogs = dailyFiles.length
  } catch { /* daily dir may not exist yet */ }

  return { totalPages, totalDailyLogs, deprecatedPages }
}

const updateStats = async (directory: string, vaultPaths: VaultPaths): Promise<void> => {
  const st = await readState(directory)
  st.stats = await collectStats(vaultPaths)
  await writeState(directory, st)
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

const ensureCommands = async (directory: string, commands: Record<string, string>): Promise<void> => {
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

const ensureSkills = async (directory: string, skills: Record<string, string>): Promise<void> => {
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

const OpenCodeEchoes: Plugin = async ({ directory }) => {
  const pluginDir = path.dirname(new URL(import.meta.url).pathname)

  const readPromptFile = async (relativePath: string): Promise<string> => {
    return await fs.readFile(path.join(pluginDir, "prompts", relativePath), "utf-8")
  }

  const ECHOES_INIT = await readPromptFile("commands/echoes-init.md")
  const ECHOES_START = await readPromptFile("commands/echoes-start.md")
  const ECHOES_END = await readPromptFile("commands/echoes-end.md")
  const ECHOES_STATUS = await readPromptFile("commands/echoes-status.md")

  const APPEND_TO_DAILY_LOG = await readPromptFile("skills/echoes-append-to-daily-log.md")
  const SEARCH_VAULT_PAGES = await readPromptFile("skills/echoes-search-vault-pages.md")
  const CREATE_OR_UPDATE_PAGE = await readPromptFile("skills/echoes-create-or-update-page.md")

  const commands: Record<string, string> = {
    "echoes-init.md": ECHOES_INIT,
    "echoes-start.md": ECHOES_START,
    "echoes-end.md": ECHOES_END,
    "echoes-status.md": ECHOES_STATUS,
  }
  const skills: Record<string, string> = {
    "echoes-append-to-daily-log": APPEND_TO_DAILY_LOG,
    "echoes-search-vault-pages": SEARCH_VAULT_PAGES,
    "echoes-create-or-update-page": CREATE_OR_UPDATE_PAGE,
  }

  const paths = resolveVaultPaths(directory)
  const indexFile = path.join(paths.vault, "index.md")

  await ensureVaultDirs(paths)
  try {
    await fs.access(indexFile)
  } catch {
    await fs.writeFile(indexFile, DEFAULT_INDEX)
  }

  await ensureCommands(directory, commands)
  await ensureSkills(directory, skills)

  const state = await readState(directory)
  state.pluginVersion = await getPluginVersion()
  state.session.started = false
  state.session.saved = false
  state.stats = await collectStats(paths)
  await writeState(directory, state)

  return {
    config: async (input) => {
      input.command = input.command || {}
      for (const [name, cmd] of Object.entries(commands)) {
        const { template, description, agent } = parseCommandFrontmatter(cmd)
        input.command[name.replace(".md", "")] = { template, description, agent }
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

          const st = await readState(directory)
          st.session.saved = true
          st.session.lastSave = new Date().toISOString()
          st.stats = await collectStats(paths)
          await writeState(directory, st)

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
          await updateStats(directory, paths)
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

          await updateStats(directory, paths)

          const action = existed ? "updated" : "created"
          const parts = [`✅ Page ${action}: EchoesVault/pages/${fileName}`]
          if (!existed && args.indexDescription) {
            parts.push(`📑 Index: synced`)
          }
          return parts.join("\n")
        },
      }),
      echoes_activate_vault: tool({
        description:
          "Mark the EchoesVault as activated. Called automatically during /echoes-init to register the vault in the status tracker.",
        args: {},
        async execute(_args, _ctx) {
          const st = await readState(directory)
          st.initialized = true
          st.stats = await collectStats(paths)
          await writeState(directory, st)
          return "EchoesVault activated."
        },
      }),
      echoes_start_session: tool({
        description:
          "Mark the current EchoesVault session as started. Called automatically during /echoes-start to update the status tracker.",
        args: {},
        async execute(_args, _ctx) {
          const st = await readState(directory)
          st.session.started = true
          st.session.saved = false
          st.session.lastStart = new Date().toISOString()
          await writeState(directory, st)
          return "EchoesVault session started."
        },
      }),
    },
  }
}

export default { server: OpenCodeEchoes }
export { OpenCodeEchoes }
