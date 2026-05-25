# Prior Lazylanding Agent-Readiness Checklist

This checklist preserves the Lazylanding audit scope that seeded the skill. It came from an orank-style agent-readiness scan and maps to the scoring rubric.

## Discovery

- Make developer resources discoverable by brand and use-case search.
- Publish API docs, OpenAPI, auth docs, webhooks, MCP, and agent docs at predictable URLs.
- Publish topical authority pages: comparisons, alternatives, tutorials, integration guides, and best-for-use-case pages.
- Ensure raw homepage HTML has meaningful text, headings, and content density without JavaScript.
- Serve MCP discovery or reference it in `llms.txt`.
- Add a dedicated `?mode=agent` view with endpoints, auth, and capabilities.
- Add semantic HTML and schema.org markup.
- Create `/llms.txt` and `/llms-full.txt`.
- Add agent discovery files such as `/.well-known/agent.json`, `/.well-known/ai-plugin.json`, and `/.well-known/agent-card.json`.
- Publish or register official skills, platform config, and public repo guidance where applicable.
- Add `/pricing.md`.
- Advertise sitemap, markdown alternates, OpenAPI, API catalog, and docs through HTTP `Link` headers.
- Differentiate AI crawler policy in `robots.txt` where useful.

## Identity

- Enrich `llms.txt` with product overview, use cases, constraints, capabilities, limitations, and API links.
- Add Organization/Product/SoftwareApplication JSON-LD.
- Link homepage to public API or developer docs.
- Add agent-specific when-to-use guidance.
- Include quickstart, authentication walkthrough, and example requests.
- Add `sameAs` links to credible external identity anchors.
- Publish citability-friendly content with author credentials, dated posts, and concrete explanations.
- Add Speakable, FAQPage, Service/Product, BreadcrumbList, and review schema when relevant.
- Publish About, Contact, and Privacy trust pages.
- Add clear competitive positioning and comparison pages.

## Auth and Access

- Expose a public API or document why the product is not programmable.
- Publish OpenAPI at `/openapi.json` or equivalent.
- Create a developer portal.
- Document scoped permissions, API tokens, and agent auth.

## Agent Integration

- Expose MCP or WebMCP when agents should call tools.
- Publish rate limits and structured errors.
- Provide CLI/SDK or clear install instructions.
- Define typed schemas and pagination/field-selection.
- Publish MCP `server-card.json`.
- Keep response payloads context-window efficient.

## User Experience

- Support AI platform integrations or clear setup docs.
- Publish an OpenAI/agent plugin manifest where relevant.
- Support generative UI/MCP Apps if the product experience benefits from embedded UI.
- Make the homepage answer multi-turn product questions: what it does, why it is different, pricing, onboarding, and next action.

