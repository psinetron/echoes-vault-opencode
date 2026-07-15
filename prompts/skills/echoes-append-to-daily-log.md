---
name: echoes_append_to_daily_log
description: Append an intermediate technical note or decision to today's daily log immediately after completing a sub-task.
---

# TOOL USAGE: echoes_append_to_daily_log
You are equipped with a scratchpad tool to manage your cognitive load. You MUST use this tool to offload important context into `EchoesVault/daily/YYYY-MM-DD.md`.

## 🎯 EXACT TRIGGER CONDITIONS (WHEN TO CALL THIS TOOL)
Do NOT use this tool randomly. You MUST invoke this tool IMMEDIATELY in the current response if ANY of the following specific events occur:
1. **Task Completion:** We successfully finish a logical unit of work (e.g., a script works, a bug is verified as fixed, tests pass) BEFORE starting the next user request.
2. **Context Switch:** The user asks to change focus (e.g., "Now let's work on the frontend" after we just worked on the backend).
3. **Architectural Agreement:** We just agreed on a core rule, library choice, database schema, or API contract.
4. **Explicit User Command:** The user explicitly tells you to "take a note", "remember this", "save our progress", or "log this".

## ⚠️ RULES
1. **Be Concise:** Write ONLY dry facts and bullet points (e.g., "Refactored AuthGuard to use JWT refresh tokens"). No conversational filler.
2. **Do Not Interrupt Flow:** Make the tool call silently or add a brief confirmation in your response like: *"Logged the AuthGuard update to the daily vault. Ready for the frontend."*
3. **No File Overwrites:** This tool ONLY appends to the end of today's file.

## 📥 PAYLOAD PARAMETERS
- `logEntry`: (String) The markdown-formatted bullet points to append.
