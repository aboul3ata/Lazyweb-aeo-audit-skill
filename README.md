# Lazyweb:AEO_audit Skill

Codex skill and zero-dependency Node CLI for auditing websites against answer-engine optimization, AI search visibility, and agent-readiness requirements.

```bash
npm install
node ./bin/lazyweb-aeo-audit.mjs https://lazyweb.com --out reports
```

The audit produces a score, Markdown report, JSON evidence file, and prioritized recommendations.

## What It Checks

- `llms.txt`, `llms-full.txt`, `pricing.md`, OpenAPI, sitemap, robots, Link headers, and `.well-known` agent files.
- Raw HTML crawlability, semantic headings, content density, JavaScript-heavy shells, and citation-friendly text.
- JSON-LD identity, schema type breadth, `sameAs`, trust anchors, privacy/contact/about pages, and author/date signals.
- Pricing, comparison, use-case, FAQ, getting-started, and developer documentation.
- MCP/WebMCP/server-card, API auth, rate limits, SDK/CLI docs, and agent error-recovery hints.

## Commands

```bash
npm test
node ./bin/lazyweb-aeo-audit.mjs https://tryprofound.com --out reports
npm run test:live
```

`npm run test:live` audits ten landing pages and writes reports under `reports/live-smoke/`.

## Skill Use

Copy this repo or install the root `SKILL.md` as a Codex skill. Invoke it as `Lazyweb:AEO_audit`. When the user asks for an AEO audit, run the CLI first, inspect the evidence, then summarize the highest-leverage recommendations.
