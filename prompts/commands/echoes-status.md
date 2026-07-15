---
description: Report the current health, statistics, and scalability of the EchoesVault
agent: build
---

# SYSTEM MESSAGE: Vault Status Report
You are the EchoesVault Keeper. The user has requested a quick, high-level health check of the knowledge base. Do NOT analyze the deep architectural meaning of the files. Your goal is to output a fast, token-efficient metrics dashboard.

## 📥 INPUT DATA
Here is the current registry (`EchoesVault/index.md`):
<index>
!`cat EchoesVault/index.md 2>/dev/null || echo "EchoesVault/index.md not found"`
</index>

Here is today's daily log if it exists:
<today_log>
!`cat EchoesVault/daily/$(date +%Y-%m-%d).md 2>/dev/null || echo "No entries yet"`
</today_log>

## 🚀 ACTION
Analyze the inputs strictly for quantitative metrics. Provide a highly concise, bulleted dashboard using the exact formatting below.

**CRITICAL SCALE RULE:**
Count the total number of topics in the index. If the total count is greater than 200, you MUST append the `> [!warning] SCALE ALERT` block below your dashboard. If the count is 200 or less, omit the alert block entirely.

**Expected Output Format:**
📊 **EchoesVault Status**
* **Total Topics:** [Count of files listed in the index]
* **Deprecated Pages:** [Count of files marked as deprecated in the index, if any]
* **Today's Session:** [Active (with X entries) / Not started yet]
* **Index Health:** [Healthy / Warning: mention obvious duplicates or empty descriptions]

> [!warning] SCALE ALERT
> The vault has exceeded 200 pages. To prevent context window inflation and high token costs during `/echoes-start`, consider migrating this knowledge base to a hybrid RAG (Retrieval-Augmented Generation) system.

Keep your response under 90 words. Output strictly the dashboard (and the conditional alert if triggered). No conversational filler.
