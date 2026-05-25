# AEO Tools and Research Notes

This reference summarizes recurring requirements from current AEO/GEO tooling and research scans. It is not a vendor endorsement list.

## Tool Categories to Account For

- AI visibility platforms: brand/citation monitoring platforms, prompt-level share-of-voice tools, AI search monitors, and classic SEO suites adding AI visibility features.
- Technical AI-readiness checkers: llms.txt validators, robots/AI crawler policy checkers, structured data validators, OpenAPI/MCP manifest checks, schema validators.
- Prompt and citation monitors: tools that track brand mention share, prompt-level citations, source overlap, and platform variance across ChatGPT, Gemini, Perplexity, Claude, and Google AI surfaces.
- Content and answerability tools: classic SEO crawlers plus content quality checks for direct answers, FAQs, comparisons, alternatives, pricing, use cases, and quotable evidence.
- Implementation/action platforms: tools that not only monitor mentions, but also generate content, recommend fixes, connect analytics/log data, or create execution workflows.

## Shared Signals

- Owned machine-readable files are table stakes: `llms.txt`, long-context docs, pricing markdown, OpenAPI, and agent discovery manifests.
- Raw HTML still matters because crawlers and AI agents may not execute the same JavaScript path as users.
- Schema.org identity is a low-cost disambiguation layer, especially for ambiguous brand names.
- Third-party citations matter. AI engines often cite community, social, review, marketplace, and editorial sources.
- Prompt language and platform choice change outcomes, so audits should not rely on one query.
- Content must answer specific jobs, not just describe the company. Use cases, alternatives, comparison pages, pricing, and getting-started content are high-leverage.
- Agent integration moves beyond citation: MCP, API docs, scoped auth, rate limits, CLI/SDK, and setup instructions let agents actually use the product.
- Treat `llms.txt` as an agent-readable documentation convention, not a guaranteed ranking lever. The official proposal describes a Markdown file for LLM-friendly content, but the broader SEO/AEO community still debates direct visibility impact.
- For robots policy, distinguish crawling/indexing, AI inputs for real-time answers, and AI training. Cloudflare's Content Signals vocabulary uses `search`, `ai-input`, and `ai-train` as separate intent categories.
- For MCP checks, prefer official Streamable HTTP transport expectations and a verifiable tool-list call over a merely linked marketing page.
- For API checks, OpenAPI should include operation IDs, schemas, auth, and response examples that can be transformed into function/tool calls.

## Recommended External Validation

- Validate structured data with Schema.org or Google rich results tooling where appropriate.
- Fetch pages without JavaScript and compare with rendered browser text.
- Search brand plus category prompts across major answer engines.
- Run recurring citation snapshots because AI search is volatile.
- Verify install/setup instructions in a clean agent environment when the site exposes an MCP, plugin, SDK, or CLI.

## Source Pointers

- Official llms.txt proposal: https://llmstxt.org/
- Official MCP transport specification: https://modelcontextprotocol.io/specification/draft/basic/transports
- Official OpenAPI specification: https://spec.openapis.org/oas/
- Cloudflare Content Signals policy docs: https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/
- AEO/GEO measurement research examples: citation selection/absorption frameworks, content-structure citation studies, and generative search impact studies on arXiv.
- Market scans to revisit periodically: AI visibility platforms, classic SEO suites adding AI citation tracking, brand-radar products, and emerging audit-first tools.
