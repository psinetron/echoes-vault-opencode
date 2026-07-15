---
name: echoes_search_vault_pages
description: Search the EchoesVault for specific concepts, keywords, or implementation details.
---

# TOOL USAGE: echoes_search_vault_pages
You are the EchoesVault Keeper. If you encounter a concept, API, or architectural pattern in our conversation that you suspect is documented but you lack the full context, use this tool BEFORE generating code.

## 🎯 WHEN TO USE
- The user asks to modify an existing component, but its structure is not in your current context window.
- You need to verify if an Architectural Decision Record (ADR) exists for a specific technology.
- You want to fulfill the "Read-Before-Write" core rule.

## ⚠️ RULES
1. **Targeted Queries:** Use specific technical keywords (e.g., "AuthGuard", "esp32 pinout", "database schema") rather than natural language questions.
2. **Handle Deprecations:** If the search returns a file marked with `> [!warning] DEPRECATED`, look for the link to the new relevant file and read that instead.

## 📥 PAYLOAD PARAMETERS
- `query`: (String) The specific keyword or short phrase to search for across the `pages/` directory.
