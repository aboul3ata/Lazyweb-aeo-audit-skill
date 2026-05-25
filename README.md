# Lazyweb:AEO_audit Skill

Codex skill and zero-dependency Node CLI for auditing websites against answer-engine optimization, AI search visibility, and agent-readiness requirements.

```bash
curl -fsSL https://raw.githubusercontent.com/aboul3ata/Lazyweb-aeo-audit-skill/main/install.sh | sh
lazyweb-aeo-audit
```

The first run asks which website to audit, tries to infer it from the current repo, then confirms before writing an AEO audit report. The audit produces a score, Markdown report, JSON evidence file, and prioritized recommendations.

The installer adds:

- `lazyweb-aeo-audit` to `~/.local/bin`
- `Lazyweb:AEO_audit` to `~/.codex/skills/lazyweb-aeo-audit`
- `Lazyweb:AEO_audit` to `~/.claude/skills/lazyweb-aeo-audit`

If `~/.local/bin` is not on your `PATH`, the installer prints the exact shell profile line to add.

## What It Checks

- `llms.txt`, `llms-full.txt`, `pricing.md`, OpenAPI, sitemap, robots, Link headers, and `.well-known` agent files.
- Raw HTML crawlability, semantic headings, content density, JavaScript-heavy shells, and citation-friendly text.
- JSON-LD identity, schema type breadth, `sameAs`, trust anchors, privacy/contact/about pages, and author/date signals.
- Pricing, comparison, use-case, FAQ, getting-started, and developer documentation.
- MCP/WebMCP/server-card, API auth, rate limits, SDK/CLI docs, and agent error-recovery hints.

## Commands

```bash
npm test
lazyweb-aeo-audit
lazyweb-aeo-audit https://lazyweb.com --out reports
npm run test:live
```

`npm run test:live` audits ten landing pages and writes reports under `reports/live-smoke/`.

## Skill Use

Invoke it as `Lazyweb:AEO_audit` in Claude or Codex. When the user asks for an AEO audit, run `lazyweb-aeo-audit` first, inspect the evidence, then summarize the highest-leverage recommendations.
