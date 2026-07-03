/** @jsxImportSource @opentui/solid */
import type { TuiPlugin } from "@opencode-ai/plugin/tui"
import { createSignal, onCleanup } from "solid-js"
import * as fs from "node:fs"
import * as path from "node:path"

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
}

const STATE_PATH = path.join(process.cwd(), ".opencode", "echoes-state.json")

const readState = (): EchoesState | null => {
  try {
    const raw = fs.readFileSync(STATE_PATH, "utf-8")
    return JSON.parse(raw) as EchoesState
  } catch {
    return null
  }
}

const tui: TuiPlugin = async (api) => {
  const theme = api.theme.current

  api.slots.register({
    slots: {
      sidebar_content() {
        const [state, setState] = createSignal<EchoesState | null>(readState())

        const interval = setInterval(() => setState(readState()), 3000)
        onCleanup(() => clearInterval(interval))

        const statusColor = () => {
          const s = state()
          if (!s || !s.initialized) return theme.error
          if (s.session.saved) return theme.accent
          if (s.session.started) return theme.success
          return theme.warning
        }

        const statusLabel = () => {
          const s = state()
          if (!s || !s.initialized) return "Not Activated"
          if (s.session.saved) return "Memory Saved"
          if (s.session.started) return "Active"
          return "Session Not Started"
        }

        const statusDesc = () => {
          const s = state()
          if (!s || !s.initialized) return null
          if (s.session.saved) return "Vault memorized session data"
          if (s.session.started) return null
          return null
        }

        const statusCmd = () => {
          const s = state()
          if (!s || !s.initialized) return "/echoes-init"
          if (s.session.saved) return null
          if (s.session.started) return "/echoes-end"
          return "/echoes-start"
        }

        const statusCmdHint = () => {
          const s = state()
          if (!s || !s.initialized) return "to activate vault"
          if (s.session.saved) return null
          if (s.session.started) return "before closing"
          return "to load context"
        }

        return (
          <box flexDirection="column">
            <box flexDirection="row">
              <text fg={statusColor()}><b>• </b></text>
              <text fg={theme.textMuted}><b>Echoes</b></text>
              <text fg={theme.text}><b>Vault</b></text>
              <text fg={theme.textMuted}> v{state()?.pluginVersion ?? ""}</text>
            </box>
            <text fg={statusColor()}>{statusLabel()}</text>
            {statusDesc() && (
              <text fg={theme.textMuted}>{statusDesc()}</text>
            )}
            {statusCmd() && (
              <box flexDirection="row">
                <text fg={theme.textMuted}>Run </text>
                <text fg={theme.text}>{statusCmd()}</text>
                <text fg={theme.textMuted}> {statusCmdHint()}</text>
              </box>
            )}
          </box>
        )
      },
    },
  })
}

export default { id: "echoes-vault-ui", tui }
