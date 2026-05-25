import { mkdir, writeFile } from "node:fs/promises";
import { URL } from "node:url";

const DEFAULT_TIMEOUT_MS = 15000;

const AUXILIARY_PATHS = [
  { key: "llms", label: "llms.txt", path: "/llms.txt" },
  { key: "llmsFull", label: "llms-full.txt", path: "/llms-full.txt" },
  { key: "pricingMd", label: "pricing.md", path: "/pricing.md" },
  { key: "pricing", label: "pricing page", path: "/pricing" },
  { key: "openapi", label: "OpenAPI", path: "/openapi.json" },
  { key: "robots", label: "robots.txt", path: "/robots.txt" },
  { key: "sitemap", label: "sitemap.xml", path: "/sitemap.xml" },
  { key: "agentJson", label: "agent.json", path: "/.well-known/agent.json" },
  { key: "aiPlugin", label: "ai-plugin.json", path: "/.well-known/ai-plugin.json" },
  { key: "agentCard", label: "agent-card.json", path: "/.well-known/agent-card.json" },
  { key: "mcpServerCard", label: "MCP server-card", path: "/.well-known/mcp/server-card.json" },
  { key: "wellKnownMcp", label: "well-known MCP", path: "/.well-known/mcp" },
  { key: "agentMode", label: "agent mode", path: "/?mode=agent" }
];

const DOC_TEXT_SURFACE_KEYS = new Set([
  "llms",
  "llmsFull",
  "pricingMd",
  "pricing",
  "openapi",
  "agentJson",
  "aiPlugin",
  "agentCard",
  "mcpServerCard",
  "wellKnownMcp",
  "agentMode"
]);

const CATEGORY_MAX = {
  discovery: 20,
  crawlability: 20,
  entityTrust: 20,
  answerability: 20,
  integration: 20
};

export async function auditSite(inputUrl, options = {}) {
  const url = normalizeUrl(inputUrl);
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const homepage = await fetchText(url.href, fetcher, timeoutMs);
  const parsed = parseHtml(homepage.body || "");
  const auxiliaryBaseUrl = resolveAuxiliaryBaseUrl(url, homepage, parsed);
  const auxiliary = {};

  await Promise.all(AUXILIARY_PATHS.map(async (item) => {
    const target = new URL(item.path, auxiliaryBaseUrl.origin).href;
    auxiliary[item.key] = await fetchText(target, fetcher, timeoutMs);
  }));

  const evidence = buildEvidence(auxiliaryBaseUrl, homepage, auxiliary, parsed);
  const categories = scoreCategories(evidence, parsed, auxiliary);
  const totalScore = Object.values(categories).reduce((sum, category) => sum + category.score, 0);
  const grade = gradeFor(totalScore);
  const recommendations = buildRecommendations(evidence, categories);

  return {
    url: url.href,
    origin: url.origin,
    auditedAt: new Date().toISOString(),
    score: totalScore,
    grade,
    categories,
    evidence,
    recommendations,
    auxiliary: summarizeAuxiliary(auxiliary)
  };
}

export function renderMarkdownReport(result) {
  const categoryRows = Object.entries(result.categories)
    .map(([key, category]) => `| ${category.label} | ${category.score}/${category.max} | ${category.notes.join("<br>")} |`)
    .join("\n");

  const recommendationRows = result.recommendations.length
    ? result.recommendations.map((rec, index) => [
      `### ${index + 1}. ${rec.title}`,
      "",
      `- Priority: ${rec.priority}`,
      `- Category: ${rec.category}`,
      `- Evidence: ${rec.evidence}`,
      `- Recommendation: ${rec.action}`,
      `- Validate by: ${rec.validation}`
    ].join("\n")).join("\n\n")
    : "No major recommendations. Re-run with manual prompt/citation checks before treating the site as complete.";

  const surfaceRows = result.evidence.surfaces.map((surface) => (
    `| ${surface.label} | ${surface.present ? "Present" : "Missing"} | ${surface.status || "n/a"} | ${surface.detail} |`
  )).join("\n");

  return `# AEO Audit: ${result.url}

Audit date: ${result.auditedAt}

Overall score: **${result.score}/100 (${result.grade})**

## Category Scores

| Category | Score | Notes |
|---|---:|---|
${categoryRows}

## Highest-Leverage Recommendations

${recommendationRows}

## Evidence: Machine-Readable Surfaces

| Surface | Status | HTTP | Detail |
|---|---|---:|---|
${surfaceRows}

## Evidence: Homepage

- Final URL: ${result.evidence.homepage.finalUrl || "unknown"}
- HTTP status: ${result.evidence.homepage.status || "unknown"}
- Title: ${result.evidence.homepage.title || "missing"}
- Meta description: ${result.evidence.homepage.metaDescription || "missing"}
- H1 count: ${result.evidence.homepage.h1Count}
- Heading count: ${result.evidence.homepage.headingCount}
- Visible words in raw HTML: ${result.evidence.homepage.wordCount}
- JSON-LD blocks: ${result.evidence.homepage.jsonLdCount}
- Invalid JSON-LD blocks: ${result.evidence.homepage.invalidJsonLdCount}
- Schema types: ${result.evidence.homepage.schemaTypes.join(", ") || "none detected"}
- Canonical: ${result.evidence.homepage.canonical || "missing"}
- JavaScript-heavy risk: ${result.evidence.homepage.jsHeavyRisk ? "yes" : "no"}

## Profound Research Lens Applied

- Query phrasing can change citations, so test brand, category, comparison, and use-case prompts separately.
- Third-party sources such as Reddit, LinkedIn, YouTube, review sites, and category pages can influence AI answers.
- AI search is volatile; use this report as a dated snapshot and repeat checks after major site or model changes.
- Strong AEO combines classic SEO crawlability with machine-readable agent setup surfaces.

## What To Hand To Engineering

Start with the top three recommendations. Each one has a validation step that can be checked from a terminal or browser without relying on intent.
`;
}

export async function writeReportFiles(result, outDir) {
  await mkdir(outDir, { recursive: true });
  const slug = domainSlug(result.url);
  const mdPath = `${outDir}/${slug}-aeo-audit.md`;
  const jsonPath = `${outDir}/${slug}-aeo-audit.json`;
  await writeFile(mdPath, renderMarkdownReport(result), "utf8");
  await writeFile(jsonPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return { mdPath, jsonPath };
}

function normalizeUrl(input) {
  const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  const url = new URL(withProtocol);
  if (!url.pathname || url.pathname === "") url.pathname = "/";
  return url;
}

function resolveAuxiliaryBaseUrl(inputUrl, homepage, parsed) {
  const finalUrl = safeUrl(homepage.finalUrl) || inputUrl;

  if (finalUrl.origin === inputUrl.origin && parsed.canonical) {
    try {
      const canonical = new URL(parsed.canonical, inputUrl.href);
      if (canonical.protocol === finalUrl.protocol && stripWww(canonical.hostname) === stripWww(finalUrl.hostname)) {
        return new URL("/", canonical.origin);
      }
    } catch {
      // Fall through to the requested origin when canonical markup is malformed.
    }
  }

  return new URL("/", finalUrl.origin);
}

async function fetchText(url, fetcher, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "LazywebAEOAudit/0.1 (+https://github.com/aboul3ata/Lazyweb-aeo-audit-skill)",
        "accept": "text/html,application/json,text/plain,*/*"
      }
    });
    const body = await response.text();
    return {
      url,
      finalUrl: response.url,
      status: response.status,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries()),
      body
    };
  } catch (error) {
    return {
      url,
      finalUrl: "",
      status: 0,
      ok: false,
      headers: {},
      body: "",
      error: error?.message || String(error)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function parseHtml(html) {
  const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaDescription = attrFromMeta(html, "description");
  const robotsMeta = attrFromMeta(html, "robots");
  const canonical = firstMatch(html, /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i)
    || firstMatch(html, /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*>/i);
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => cleanText(m[1])).filter(Boolean);
  const headings = [...html.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)].map((m) => cleanText(m[1])).filter(Boolean);
  const visibleText = cleanText(html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " "));
  const words = visibleText.match(/[A-Za-z0-9][A-Za-z0-9'-]*/g) || [];
  const jsonLdResult = parseJsonLd(html);
  const jsonLd = jsonLdResult.blocks;
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)].map((m) => m[1]);
  const questions = (visibleText.match(/\?/g) || []).length;
  const listCount = (html.match(/<(ul|ol|li)\b/gi) || []).length;
  const tableCount = (html.match(/<table\b/gi) || []).length;
  const semanticCount = (html.match(/<(main|section|article|nav|aside|header|footer)\b/gi) || []).length;

  return {
    title: decodeEntities(title),
    metaDescription: decodeEntities(metaDescription),
    robotsMeta,
    canonical,
    h1s,
    headings,
    visibleText,
    wordCount: words.length,
    jsonLd,
    invalidJsonLdCount: jsonLdResult.invalidCount,
    schemaTypes: schemaTypes(jsonLd),
    links,
    questions,
    listCount,
    tableCount,
    semanticCount,
    hasFaqText: /\b(faq|frequently asked|questions)\b/i.test(visibleText),
    hasPricingText: /\b(pricing|price|plans?|free trial|enterprise)\b/i.test(visibleText),
    hasComparisonText: /\b(compare|comparison|alternative|versus| vs\.? )\b/i.test(visibleText),
    hasUseCaseText: /\b(use cases?|for teams|for developers|for marketers|for agencies|who it's for)\b/i.test(visibleText),
    hasApiText: /\b(api|developer|openapi|sdk|cli|webhook|mcp|model context protocol)\b/i.test(visibleText),
    hasNumbers: /\b\d+[\d,]*(?:\.\d+)?%?\b/.test(visibleText)
  };
}

function buildEvidence(url, homepage, auxiliary, parsed) {
  const surfaces = AUXILIARY_PATHS.map((item) => {
    const result = auxiliary[item.key];
    const present = surfaceIsPresent(item, result, homepage);
    return {
      key: item.key,
      label: item.label,
      url: new URL(item.path, url.origin).href,
      present,
      status: result.status,
      detail: result.error || `${result.body.trim().length} bytes`
    };
  });

  const linkHeader = homepage.headers.link || "";
  const agentDocLinkHeader = hasAgentDocLinkHeader(linkHeader);
  const robots = auxiliary.robots?.body || "";
  const trustPages = {
    about: parsed.links.some((href) => /\/about\b/i.test(href)),
    contact: parsed.links.some((href) => /\/contact\b/i.test(href)),
    privacy: parsed.links.some((href) => /\/privacy\b/i.test(href))
  };

  return {
    homepage: {
      status: homepage.status,
      ok: homepage.ok,
      finalUrl: homepage.finalUrl,
      title: parsed.title,
      metaDescription: parsed.metaDescription,
      canonical: parsed.canonical,
      h1Count: parsed.h1s.length,
      headingCount: parsed.headings.length,
      wordCount: parsed.wordCount,
      jsonLdCount: parsed.jsonLd.length,
      invalidJsonLdCount: parsed.invalidJsonLdCount,
      schemaTypes: parsed.schemaTypes,
      robotsMeta: parsed.robotsMeta,
      jsHeavyRisk: hasJsHeavyRisk(homepage.body, parsed.wordCount)
    },
    surfaces,
    linkHeader,
    agentDocLinkHeader,
    robots: {
      present: Boolean(auxiliary.robots?.ok),
      hasAiPolicy: /content-signal|ccbot|gptbot|google-extended|perplexitybot|claudebot|bytespider|ai-train|ai-input/i.test(robots)
    },
    trustPages,
    parsed
  };
}

function scoreCategories(evidence, parsed, auxiliary) {
  const hasSurface = (key) => evidence.surfaces.find((surface) => surface.key === key)?.present;
  const agentDocLinkHeader = evidence.agentDocLinkHeader;
  const homepageUsable = Boolean(evidence.homepage.ok);
  const homepageText = homepageUsable ? parsed.visibleText : "";
  const homepageLinks = homepageUsable ? parsed.links : [];
  const wellKnownCount = ["agentJson", "aiPlugin", "agentCard", "mcpServerCard", "wellKnownMcp"].filter(hasSurface).length;
  const schema = new Set(parsed.schemaTypes.map((type) => type.toLowerCase()));
  const hasOrg = [...schema].some((type) => type.includes("organization"));
  const hasBroadSchema = [...schema].some((type) => ["product", "softwareapplication", "service", "faqpage", "website", "breadcrumblist"].includes(type));
  const hasSameAs = /"sameAs"\s*:|sameAs/i.test(JSON.stringify(parsed.jsonLd));
  const hasContactSchema = /contactPoint|email|telephone|logo/i.test(JSON.stringify(parsed.jsonLd));
  const docsText = Object.entries(auxiliary)
    .filter(([key, item]) => item.ok && DOC_TEXT_SURFACE_KEYS.has(key) && hasSurface(key))
    .map(([, item]) => item.body || "")
    .join("\n");
  const evidenceText = `${docsText}\n${homepageText}`;
  const hasDeveloperDocs = hasSurface("openapi") || /\b(api docs?|developer docs?|developer portal|openapi|sdk|cli|webhooks?)\b/i.test(evidenceText);
  const hasAuthDocs = /\b(auth|api key|token|oauth|scope|permission|rate limits?|retry-after|x-ratelimit)\b/i.test(evidenceText);
  const hasMcpDocs = hasSurface("wellKnownMcp") || hasSurface("mcpServerCard") || /\b(mcp|model context protocol|webmcp|server-card)\b/i.test(evidenceText);

  return {
    discovery: category("Discovery and machine-readable docs", CATEGORY_MAX.discovery, [
      points(hasSurface("llms"), 4, "llms.txt is present", "llms.txt is missing or thin"),
      points(hasSurface("llmsFull"), 2, "llms-full.txt is present", "llms-full.txt is missing"),
      points(hasSurface("pricingMd") || hasSurface("pricing"), hasSurface("pricingMd") ? 3 : 1, "pricing is discoverable", "pricing.md and pricing page are missing"),
      points(hasSurface("robots") && hasSurface("sitemap"), 3, "robots.txt and sitemap.xml are present", "robots.txt or sitemap.xml is missing"),
      points(agentDocLinkHeader, 2, "HTTP Link headers advertise machine-readable docs", "HTTP Link headers do not advertise machine-readable docs"),
      points(hasSurface("agentMode"), 2, "agent mode is available", "?mode=agent is missing"),
      points(wellKnownCount >= 2, 4, `${wellKnownCount} well-known agent surfaces found`, "well-known agent discovery files are missing")
    ]),
    crawlability: category("Crawlability and semantic content", CATEGORY_MAX.crawlability, [
      points(evidence.homepage.ok && parsed.title && parsed.metaDescription, 3, "homepage has status/title/description", "homepage title or meta description is missing"),
      points(homepageUsable && parsed.h1s.length === 1 && parsed.headings.length >= 3, 3, "heading structure is usable", "H1 or heading structure is weak"),
      points(homepageUsable && parsed.wordCount >= 500, 4, "raw HTML has substantial visible text", "raw HTML has too little visible text"),
      points(homepageUsable && parsed.wordCount >= 100 && !evidence.homepage.jsHeavyRisk, 4, "important content appears without heavy JS risk", "raw HTML looks JavaScript-heavy or thin"),
      points(homepageUsable && parsed.semanticCount >= 5 && (parsed.listCount >= 5 || parsed.tableCount > 0), 3, "semantic sections/lists/tables are present", "semantic structure is thin"),
      points(homepageUsable && canonicalIsCoherent(parsed.canonical, evidence.homepage.finalUrl) && !/noindex/i.test(parsed.robotsMeta || ""), 3, "canonical and index directives are coherent", "canonical or index directives need review")
    ]),
    entityTrust: category("Entity, trust, and structured data", CATEGORY_MAX.entityTrust, [
      points(homepageUsable && parsed.jsonLd.length > 0, 3, "JSON-LD is present", "JSON-LD is missing"),
      points(homepageUsable && hasOrg && hasContactSchema, 3, "organization identity has contact/logo detail", "Organization schema is missing or incomplete"),
      points(homepageUsable && hasBroadSchema, 4, "schema type breadth exists", "schema breadth is too narrow"),
      points(homepageUsable && hasSameAs, 2, "sameAs identity anchors exist", "sameAs anchors are missing"),
      points(homepageUsable && evidence.trustPages.about && evidence.trustPages.contact && evidence.trustPages.privacy, 3, "trust pages are linked", "about/contact/privacy links are incomplete"),
      points(homepageUsable && /\b(privacy|security|status|support|updated|published|author)\b/i.test(homepageText), 2, "freshness/support/trust signals exist", "freshness and support signals are thin"),
      points(homepageUsable && parsed.title && parsed.metaDescription && (hasOrg || hasSameAs), 3, "brand disambiguation signals exist", "brand disambiguation is weak")
    ]),
    answerability: category("Answerability and citation readiness", CATEGORY_MAX.answerability, [
      points(homepageUsable && /\b(what|help|platform|product|software|service|for)\b/i.test(homepageText) && parsed.wordCount >= 300, 4, "homepage explains what the product does", "product explanation is too thin"),
      points(homepageUsable && parsed.hasNumbers, 3, "concrete numerical claims are present", "quotable numerical claims are missing"),
      points(homepageUsable && (parsed.hasUseCaseText || parsed.hasComparisonText), 4, "use-case or comparison content is present", "non-brand discovery content is weak"),
      points((homepageUsable && parsed.hasPricingText) || hasSurface("pricing") || hasSurface("pricingMd"), 3, "pricing or plan language is extractable", "pricing is not extractable"),
      points(homepageUsable && (parsed.hasFaqText || parsed.questions >= 4 || parsed.tableCount > 0), 3, "FAQ/questions/tables support citations", "FAQ/questions/tables are missing"),
      points(homepageLinks.length >= 12, 3, "internal/external references are available", "reference and internal-link surface is thin")
    ]),
    integration: category("Agent integration and programmable access", CATEGORY_MAX.integration, [
      points(hasDeveloperDocs, 4, "developer/API docs are discoverable", "developer/API docs are missing"),
      points(hasAuthDocs, 4, "auth/rate-limit/error guidance is detectable", "auth, scopes, rate limits, or retry guidance are missing"),
      points(hasMcpDocs, 4, "MCP/WebMCP discovery is detectable", "MCP/WebMCP discovery is missing"),
      points(/\b(sdk|cli|install|cursor|codex|claude|chatgpt|plugin|skill)\b/i.test(evidenceText), 3, "install/SDK/CLI/platform setup is detectable", "install/SDK/CLI/platform setup is missing"),
      points(hasSurface("openapi") || /"schema"|"operationId"|response schema|pagination/i.test(docsText), 2, "schemas/examples are discoverable", "typed response schemas are missing"),
      points(hasSurface("agentMode") || hasSurface("llms") || hasSurface("pricingMd"), 3, "agent can gather setup context without UI clicks", "agent setup still depends on marketing UI")
    ])
  };
}

function category(label, max, checks) {
  const score = Math.min(max, checks.reduce((sum, check) => sum + check.score, 0));
  return {
    label,
    score,
    max,
    checks,
    notes: checks.map((check) => check.note)
  };
}

function points(condition, score, positive, negative) {
  return {
    passed: Boolean(condition),
    score: condition ? score : 0,
    note: condition ? positive : negative
  };
}

function buildRecommendations(evidence, categories) {
  const recs = [];
  const surface = (key) => evidence.surfaces.find((item) => item.key === key);
  const missing = (key) => !surface(key)?.present;

  addIf(recs, !evidence.homepage.ok, "Make the homepage fetchable by standard agents", "P0", "Crawlability", `Homepage returned HTTP ${evidence.homepage.status || "error"} to the audit fetch.`, "Allow normal search/agent user agents to retrieve public marketing HTML, or provide a clean machine-readable alternate with Link headers.", "curl -I the homepage with a generic user agent and confirm a 2xx response.");
  addIf(recs, missing("llms"), "Publish a substantive /llms.txt", "P0", "Discovery", "No usable /llms.txt was fetched.", "Create /llms.txt with overview, use cases, pricing/docs links, API/MCP instructions, constraints, and support contacts.", "curl -i https://domain.com/llms.txt and confirm 20+ useful lines.");
  addIf(recs, missing("pricingMd"), "Add /pricing.md for agent plan comparison", "P0", "Discovery", "Machine-readable pricing.md is missing.", "Publish plan names, prices, limits, feature gates, trial terms, enterprise notes, and last-updated date in Markdown.", "curl https://domain.com/pricing.md and verify agents can compare tiers without rendering HTML.");
  addIf(recs, evidence.homepage.wordCount < 500, "Make raw HTML answer what the product does", "P0", "Crawlability", `Only ${evidence.homepage.wordCount} visible words were found in raw HTML.`, "Server-render or prerender a clear product explanation, use cases, differentiation, pricing/next step, and FAQs.", "curl the homepage and verify the text is present before JavaScript executes.");
  addIf(recs, missing("agentMode"), "Add a dedicated ?mode=agent view", "P1", "Discovery", "?mode=agent did not return a substantive agent view.", "Return compact machine-readable product facts, endpoints, auth, pricing, and setup paths when mode=agent is requested.", "curl 'https://domain.com/?mode=agent' and confirm it differs from marketing HTML.");
  addIf(recs, evidence.homepage.jsonLdCount === 0, "Add schema.org JSON-LD identity", "P1", "Entity trust", "No JSON-LD blocks were detected.", "Add Organization plus Product/SoftwareApplication/Service/WebSite/FAQPage as appropriate, including sameAs anchors.", "Run a structured-data validator and confirm schema types parse.");
  addIf(recs, !evidence.trustPages.about || !evidence.trustPages.contact || !evidence.trustPages.privacy, "Link trust anchor pages", "P1", "Entity trust", "About, Contact, and Privacy links were incomplete.", "Publish and link About, Contact, and Privacy pages with real company details and support paths.", "Fetch homepage links and verify all three pages are linked and indexable.");
  addIf(recs, missing("openapi") && categories.integration.score < 16, "Publish OpenAPI or explain no public API", "P1", "Agent integration", "No /openapi.json was fetched.", "Expose OpenAPI for programmable endpoints or document that the product is UI-only.", "curl https://domain.com/openapi.json and validate operationIds and schemas.");
  addIf(recs, missing("mcpServerCard") && missing("wellKnownMcp") && categories.integration.score < 16, "Add MCP/WebMCP discovery when agents should use tools", "P1", "Agent integration", "No MCP well-known or server card was fetched.", "Publish /.well-known/mcp/server-card.json and a reachable Streamable HTTP MCP endpoint when applicable.", "Initialize MCP with a clean client and list tools.");
  addIf(recs, !evidence.robots.hasAiPolicy, "Clarify AI crawler policy in robots.txt", "P2", "Discovery", "robots.txt did not include AI crawler or Content-Signal policy.", "Allow useful search/indexing crawlers while explicitly documenting AI training preferences where legally appropriate.", "curl /robots.txt and verify GPTBot/Google-Extended/CCBot or Content-Signal policy.");
  addIf(recs, !evidence.agentDocLinkHeader, "Advertise machine-readable docs with Link headers", "P2", "Discovery", "Homepage response did not advertise machine-readable docs in a Link header.", "Add RFC 8288 Link headers for sitemap, llms.txt, pricing.md, OpenAPI, API catalog, and agent docs.", "curl -I homepage and inspect Link headers.");

  for (const [key, category] of Object.entries(categories)) {
    if (category.score / category.max < 0.5) {
      addIf(recs, true, `Raise weak category: ${category.label}`, "P2", key, `${category.score}/${category.max} in ${category.label}.`, "Use the failed checks in the category table as a focused implementation backlog.", "Re-run the audit and verify this category clears at least 70%.");
    }
  }

  const priorityRank = { P0: 0, P1: 1, P2: 2, P3: 3 };
  return recs.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);
}

function surfaceIsPresent(item, result, homepage) {
  if (!result.ok) return false;
  const body = result.body.trim();
  const contentType = result.headers["content-type"] || "";
  if (isHomepageFallback(result, homepage)) return false;

  if (item.key === "llms") {
    return isTextLike(contentType) && body.length >= 80 && /\b(llms\.txt|overview|use cases?|pricing|api|docs|mcp|agents?|support)\b/i.test(body);
  }
  if (item.key === "llmsFull") {
    return isTextLike(contentType) && body.length >= 200;
  }
  if (item.key === "pricingMd") {
    return isTextLike(contentType) && body.length >= 20 && /\b(pricing|price|plans?|free|pro|enterprise|\$|month|year)\b/i.test(body);
  }
  if (item.key === "openapi") {
    const parsed = parseJsonObject(body);
    return hasOpenApiOperations(parsed);
  }
  if (item.key === "robots") {
    return body.length >= 10 && /\b(user-agent|allow|disallow|sitemap|content-signal)\b/i.test(body);
  }
  if (item.key === "sitemap") {
    return /<(urlset|sitemapindex|url|loc)\b/i.test(body);
  }
  if (item.key === "agentJson") {
    return jsonHasAnyKey(body, ["name", "description", "capabilities", "api", "auth", "docs", "mcp"]);
  }
  if (item.key === "aiPlugin") {
    return jsonHasAnyKey(body, ["schema_version", "name_for_model", "name_for_human", "api", "auth", "description_for_model"]);
  }
  if (item.key === "agentCard") {
    return jsonHasAnyKey(body, ["name", "description", "capabilities", "skills", "endpoints", "provider"]);
  }
  if (item.key === "mcpServerCard") {
    return jsonHasAnyKey(body, ["mcp", "tools", "server", "capabilities", "transport", "endpoint"]);
  }
  if (item.key === "wellKnownMcp") {
    return result.status >= 200 && result.status < 500 && /\b(mcp|jsonrpc|tools|server|capabilities)\b/i.test(body);
  }
  if (item.key === "agentMode") {
    if (body.length < 80) return false;
    const sameAsHomepage = body === homepage.body || similarity(body, homepage.body) > 0.96;
    const markerCount = [
      /\bagent[- ]?(readable|friendly|mode|view|setup|instructions?)\b/i,
      /\b(machine[- ]readable|for ai agents|for agents)\b/i,
      /\bllms\.txt|llms-full\.txt|pricing\.md\b/i,
      /\bopenapi|api catalog|developer portal\b/i,
      /\bmcp|model context protocol|webmcp|tools\/list\b/i,
      /\bauthentication|api key|token|scopes?|rate limits?\b/i
    ].filter((pattern) => pattern.test(body)).length;
    const htmlLooksLikeFullMarketingPage = /text\/html/i.test(contentType) && body.length > 120000;
    return !sameAsHomepage && !htmlLooksLikeFullMarketingPage && markerCount >= 2;
  }
  if (item.key === "pricing") {
    return body.length > 80 && /\b(pricing|price|plans?|free|pro|enterprise|\$|month|year)\b/i.test(body);
  }
  return body.length > 80;
}

function isHomepageFallback(result, homepage) {
  if (!homepage.body || !result.body) return false;
  if (result.body.trim() === homepage.body.trim()) return true;
  const requested = safeUrl(result.url);
  const final = safeUrl(result.finalUrl);
  const homepageFinal = safeUrl(homepage.finalUrl);
  if (requested && final && homepageFinal && requested.pathname !== "/" && final.pathname === homepageFinal.pathname) return true;
  return similarity(result.body, homepage.body) > 0.995;
}

function hasAgentDocLinkHeader(header) {
  if (!header) return false;
  const explicitAgentDocHref = /<(?:[^>]*\/)?(?:llms(?:-full)?\.txt|pricing\.md|openapi(?:\.json|\.yaml)?|sitemap\.xml|\.well-known\/(?:agent|ai-plugin|mcp|agent-card)|(?:api|docs)\/agents?)[^>]*>/i.test(header);
  const typedAgentDocRelation = /rel=["'][^"']*(?:alternate|service-desc|service-meta|sitemap|help|api|mcp|agent)[^"']*["']/i.test(header)
    && /\b(?:text\/markdown|text\/plain|application\/json|application\/openapi|application\/xml)\b/i.test(header);
  return explicitAgentDocHref || typedAgentDocRelation;
}

function canonicalIsCoherent(canonical, finalUrl) {
  if (!canonical || !finalUrl) return false;
  try {
    const final = new URL(finalUrl);
    const resolved = new URL(canonical, final);
    return resolved.protocol === final.protocol
      && stripWww(resolved.hostname) === stripWww(final.hostname)
      && trimTrailingSlash(resolved.pathname) === trimTrailingSlash(final.pathname);
  } catch {
    return false;
  }
}

function stripWww(hostname) {
  return String(hostname || "").replace(/^www\./i, "").toLowerCase();
}

function trimTrailingSlash(pathname) {
  const value = pathname || "/";
  return value.length > 1 ? value.replace(/\/+$/g, "") : "/";
}

function hasOpenApiOperations(parsed) {
  if (!parsed || !(parsed.openapi || parsed.swagger) || !parsed.paths || typeof parsed.paths !== "object") return false;
  const methods = new Set(["get", "put", "post", "delete", "options", "head", "patch", "trace"]);
  return Object.values(parsed.paths).some((pathItem) => (
    pathItem && typeof pathItem === "object" && Object.keys(pathItem).some((key) => methods.has(key.toLowerCase()))
  ));
}

function hasJsHeavyRisk(html, wordCount) {
  const executableScripts = [...html.matchAll(/<script\b([^>]*)>/gi)]
    .filter(([, attrs]) => !/type=["'](?:application\/ld\+json(?:\s*;[^"']*)?|application\/json(?:\s*;[^"']*)?|speculationrules)["']/i.test(attrs || ""));
  const hasAppRoot = /\bid=["'](?:root|app|__next|__nuxt|svelte|gatsby-focus-wrapper)["']/i.test(html);
  return (wordCount < 100 && hasAppRoot && executableScripts.length > 0)
    || (wordCount < 50 && executableScripts.length > 0)
    || (wordCount < 350 && executableScripts.length > 8);
}

function isTextLike(contentType) {
  return !contentType || /\b(text\/plain|text\/markdown|application\/json|application\/xml|application\/ya?ml|text\/ya?ml|application\/octet-stream)\b/i.test(contentType);
}

function jsonHasAnyKey(body, keys) {
  const parsed = parseJsonObject(body);
  if (!parsed) return false;
  const seen = new Set();
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    for (const [key, nested] of Object.entries(value)) {
      seen.add(key.toLowerCase());
      visit(nested);
    }
  };
  visit(parsed);
  return keys.some((key) => seen.has(key.toLowerCase()));
}

function parseJsonObject(body) {
  try {
    const parsed = JSON.parse(body);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function safeUrl(value) {
  try {
    return value ? new URL(value) : null;
  } catch {
    return null;
  }
}

function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const left = sampleForSimilarity(a);
  const right = sampleForSimilarity(b);
  const leftTokens = new Set((left.match(/[a-z0-9]{4,}/gi) || []).map((token) => token.toLowerCase()));
  const rightTokens = new Set((right.match(/[a-z0-9]{4,}/gi) || []).map((token) => token.toLowerCase()));
  if (!leftTokens.size || !rightTokens.size) return 0;
  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1;
  }
  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

function sampleForSimilarity(text) {
  const value = String(text || "");
  if (value.length <= 36000) return value;
  const midpoint = Math.max(0, Math.floor(value.length / 2) - 6000);
  return [
    value.slice(0, 12000),
    value.slice(midpoint, midpoint + 12000),
    value.slice(-12000)
  ].join("\n");
}

function addIf(list, condition, title, priority, category, evidence, action, validation) {
  if (!condition) return;
  list.push({ title, priority, category, evidence, action, validation });
}

function summarizeAuxiliary(auxiliary) {
  return Object.fromEntries(Object.entries(auxiliary).map(([key, value]) => [key, {
    url: value.url,
    finalUrl: value.finalUrl,
    status: value.status,
    ok: value.ok,
    bytes: value.body?.length || 0,
    error: value.error
  }]));
}

function parseJsonLd(html) {
  const blocks = [];
  let invalidCount = 0;
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json(?:\s*;[^"']*)?["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const raw = match[1].trim();
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      invalidCount += 1;
    }
  }
  return { blocks, invalidCount };
}

function schemaTypes(jsonLd) {
  const types = new Set();
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const type = value["@type"];
    if (Array.isArray(type)) type.forEach((item) => types.add(String(item)));
    else if (type) types.add(String(type));
    for (const nested of Object.values(value)) visit(nested);
  };
  jsonLd.forEach(visit);
  return [...types].sort();
}

function attrFromMeta(html, name) {
  return firstMatch(html, new RegExp(`<meta[^>]+name=["']${escapeRegex(name)}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i"))
    || firstMatch(html, new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*name=["']${escapeRegex(name)}["'][^>]*>`, "i"));
}

function firstMatch(text, regex) {
  const match = text.match(regex);
  return match ? cleanText(match[1]) : "";
}

function cleanText(text) {
  return decodeEntities(String(text || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function decodeEntities(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function gradeFor(score) {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function domainSlug(inputUrl) {
  const url = normalizeUrl(inputUrl);
  return url.hostname.replace(/^www\./, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}
