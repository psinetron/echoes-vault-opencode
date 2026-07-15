---
description: End the session — save memory to EchoesVault via tool commit_memory_to_echoes_vault
agent: build
---

# SYSTEM MESSAGE: Session Distillation (Distill & Save)
Our current session is coming to an end. Your task is to crystallize the knowledge we've gained today and commit it to EchoesVault.

Adhere to the principle of technical density: we do not need a transcript of our chat. We need dry architectural facts, bug fixes, applied configurations, and explicit decisions. Remember to use `> [!warning] DEPRECATED` tags if we rewrote legacy logic today.

## ACTION
You MUST invoke the system skill `commit_memory_to_echoes_vault`.

Prepare the following payload for the skill:
* **`dailySummary`**: A dense technical summary to WRAP UP the session. Acknowledge that intermediate notes may already exist in today's log. Focus this summary strictly on final outcomes, unresolved blockers, and clear next steps for the next session. This will be appended to the bottom of today's log.
* **`newPages`**: If we discussed new global concepts or made architectural decisions, formulate them as separate Markdown articles.
* **`indexAppends`**: New lines to append to the end of `EchoesVault/index.md` (e.g. `- [[new-page]]: Description of the concept.`). The plugin will handle the insertion — you do not need to reproduce the full index.
* **`indexUpdates`**: Array of `{ oldLine, newLine }` to find and replace specific lines in place within the index (e.g. deprecation updates).

Compile these data points and execute the save function immediately!
