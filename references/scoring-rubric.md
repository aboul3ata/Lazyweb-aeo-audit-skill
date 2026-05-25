# Scoring Rubric

Total score: 100 points.

## Discovery and Machine-Readable Docs - 20

- `llms.txt` exists and has substantive content: 4
- `llms-full.txt` exists for full agent context: 2
- `pricing.md` or equivalent machine-readable pricing exists: 3
- `robots.txt` and `sitemap.xml` are discoverable: 3
- HTTP `Link` headers advertise sitemap, markdown, OpenAPI, API catalog, or agent docs: 2
- `?mode=agent` or another dedicated agent view exists: 2
- At least two `.well-known` agent discovery files exist: 4

## Crawlability and Semantic Content - 20

- Homepage returns a 2xx HTML response with a useful title and meta description: 3
- Raw HTML has one clear H1 and a logical heading structure: 3
- Raw HTML contains at least 500 visible words or an intentionally concise but complete agent view: 4
- Important product explanation appears without requiring JavaScript: 4
- Semantic sections, lists, tables, or FAQs are present: 3
- Canonical URL and index directives are coherent: 3

## Entity, Trust, and Structured Data - 20

- Valid JSON-LD is present: 3
- Organization identity is present and includes name/url/contact or logo: 3
- Product, SoftwareApplication, Service, FAQPage, WebSite, BreadcrumbList, or similar schema breadth exists: 4
- `sameAs` or credible external identity anchors exist: 2
- About, Contact, and Privacy trust pages are discoverable: 3
- Author/date/freshness, status, security, or support signals exist where relevant: 2
- The brand can be disambiguated from similarly named entities: 3

## Answerability and Citation Readiness - 20

- The site directly answers what the product is, who it is for, and what job it does: 4
- It has quotable, factual passages with concrete claims and numbers: 3
- Use cases, alternatives, comparisons, or category pages cover non-brand discovery queries: 4
- Pricing, plans, limits, and next steps are easy for agents to extract: 3
- Content includes FAQs, examples, steps, or tables that fit answer-engine citations: 3
- Internal/external references support claims and help AI systems validate authority: 3

## Agent Integration and Programmable Access - 20

- OpenAPI/API docs/developer portal are discoverable when relevant: 4
- Authentication, scopes, rate limits, and error recovery are documented: 4
- MCP/WebMCP/server-card or tool discovery exists when agents should use the product: 4
- SDK, CLI, install instructions, or agent platform configs exist: 3
- Machine-readable response schemas and examples exist: 2
- The site can be set up or used by an agent without a user clicking through a marketing UI: 3

## Grades

- 90-100: A
- 80-89: B
- 70-79: C
- 60-69: D
- 0-59: F

## Evidence Standard

Do not award full credit from inferred intent. Award points only when the page, fetched auxiliary file, response header, schema, or linked document proves the requirement.
