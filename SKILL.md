---
name: "Lazyweb:AEO_audit"
description: Audit any website for AEO, GEO, LLM/agent discoverability, and answer-engine readiness. Use when a user asks for an AEO audit, AI search visibility audit, llms.txt/pricing.md/agent-discovery checklist, or prioritized recommendations for making a site easier for ChatGPT, Claude, Gemini, Perplexity, or other agents to discover, cite, and use.
---

# Lazyweb AEO Audit

Use this skill to score a website, write a Markdown report, and prioritize recommendations from highest leverage to lower leverage.

## Quick Start

Installed users should start with the guided command:

```bash
lazyweb-aeo-audit
```

The first run asks which website to audit, tries to infer it from the current repo, then confirms before writing a report. Direct usage is also supported:

```bash
lazyweb-aeo-audit https://example.com --out reports
```

The command writes:

- `reports/<domain>-aeo-audit.md`
- `reports/<domain>-aeo-audit.json`

## Audit Flow

1. Confirm the canonical URL and fetch the raw homepage HTML with redirects followed.
2. Fetch machine-readable surfaces:
   - `/llms.txt`
   - `/llms-full.txt`
   - `/pricing.md`
   - `/pricing`
   - `/openapi.json`
   - `/robots.txt`
   - `/sitemap.xml`
   - `/.well-known/agent.json`
   - `/.well-known/ai-plugin.json`
   - `/.well-known/agent-card.json`
   - `/.well-known/mcp/server-card.json`
   - `/.well-known/mcp`
   - `/?mode=agent`
3. Score the site across five categories:
   - Discovery and machine-readable docs
   - Crawlability and semantic content
   - Entity, trust, and structured data
   - Answerability and citation readiness
   - Agent integration and programmable access
4. Write a report with evidence, missing items, and prioritized recommendations.
5. For high-stakes recommendations, label inference clearly and cite the observed evidence.

## Required Checks

Treat these as table-stakes for an AEO-ready commercial website:

- `llms.txt` exists and has more than a token placeholder.
- `llms-full.txt` exists when the product needs long-form agent context.
- `pricing.md` exists for machine-readable plan comparison, even if the HTML pricing page exists.
- Product identity is clear in raw HTML without JavaScript.
- Homepage has meaningful raw text, one clear H1, headings, and semantic sections.
- JSON-LD includes at least Organization plus Product, SoftwareApplication, WebSite, FAQPage, Service, or BreadcrumbList where applicable.
- JSON-LD includes `sameAs` links when there are credible offsite identity anchors.
- Robots policy differentiates search/indexing from AI training where appropriate.
- Link headers advertise sitemap, markdown alternates, OpenAPI/API catalog, or agent docs.
- Agent discovery files exist at predictable `.well-known` locations.
- API documentation, authentication, rate limits, and OpenAPI are discoverable when the product has a programmable surface.
- MCP/WebMCP/server-card surfaces exist when the product wants agents to use tools.
- Trust anchors exist: About, Contact, Privacy, status/security where relevant.
- Content answers concrete user questions directly enough for assistants to cite.
- Comparison, alternatives, use-case, pricing, and getting-started content are present when agents need to recommend or evaluate the product.

## Research Lens

Use the references in `references/` as the durable source base:

- `references/answer-engine-research-corpus.md` covers public AI-search research themes captured at build time.
- `references/aeo-tools-and-research.md` summarizes current AEO/GEO assessment tools and research themes.
- `references/prior-lazylanding-orank-checklist.md` preserves the Lazylanding agent-readiness checklist that seeded the original work.
- `references/scoring-rubric.md` defines the exact category weights and evidence standards.

## Output Standard

Reports should be written in Markdown and include:

- Overall score and grade.
- Category scores.
- Evidence table for present and missing surfaces.
- Top recommendations sorted by leverage, not by checklist order.
- Validation commands or URLs for each recommendation.
- A short "what changed if implemented" section when the user is likely to hand the report to an engineer.

Do not present a site as complete just because it has one AI-facing file. The audit should distinguish crawlability, identity, answerability, machine-readable docs, and actual agent/tool integration.
