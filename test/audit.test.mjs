import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { auditSite, renderMarkdownReport } from "../lib/audit.mjs";
import {
  inferWebsiteFromProject,
  isDirectRun,
  normalizeWebsiteInput,
  parseCliArgs
} from "../bin/lazyweb-aeo-audit.mjs";

test("scores a strong agent-ready site higher than a thin app shell", async () => {
  const strong = await auditSite("https://example.com", { fetcher: fixtureFetcher({
    "https://example.com/": html({
      title: "Example AI Design Platform",
      description: "Example helps AI agents compare UI patterns and generate design briefs.",
      body: `<main><h1>Example AI Design Platform</h1>
        <section><h2>What it does</h2><p>${"Example is software for marketers, developers, and agencies that need AI agents to compare products, pricing, alternatives, and UI patterns. It includes 25,000 examples, API access, scoped auth, rate limits, MCP setup, CLI install instructions, SDK documentation, and clear plans. ".repeat(18)}</p></section>
        <section><h2>Use cases</h2><ul><li>Pricing research</li><li>Alternative comparisons</li><li>Developer workflows</li><li>FAQ answers</li><li>Agent setup</li></ul></section>
        <section><h2>Developer setup</h2><p>Agents can install the CLI, use the SDK, read OpenAPI schemas, and authenticate with scoped API tokens.</p></section>
        <section><h2>Frequently asked questions</h2><p>What is Example? How much does it cost? Who is it for? How do agents use it?</p><table><tr><td>Free</td><td>$0</td></tr><tr><td>Pro</td><td>$29</td></tr></table></section>
        <a href="/about">About</a><a href="/contact">Contact</a><a href="/privacy">Privacy</a><a href="/developers">Developers</a><a href="/pricing">Pricing</a><a href="/compare">Compare</a><a href="/docs">Docs</a><a href="/blog">Blog</a><a href="/support">Support</a><a href="/security">Security</a><a href="/status">Status</a><a href="/customers">Customers</a>
        <script type="application/ld+json">${JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Example",
          url: "https://example.com",
          logo: "https://example.com/logo.png",
          contactPoint: { "@type": "ContactPoint", email: "support@example.com", contactType: "support" },
          sameAs: ["https://www.linkedin.com/company/example"]
        })}</script>
        <script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "SoftwareApplication", name: "Example" })}</script>
      </main>`
    }),
    "https://example.com/llms.txt": text("Example AI Design Platform\nUse cases\nPricing\nAPI\nMCP\nAuth\nSupport\n".repeat(5)),
    "https://example.com/llms-full.txt": text("Full docs".repeat(40)),
    "https://example.com/pricing.md": text("# Pricing\nFree: $0\nPro: $29\nEnterprise: custom\n"),
    "https://example.com/pricing": html({ title: "Pricing", body: "<h1>Pricing</h1><p>Plans and prices.</p>" }),
    "https://example.com/openapi.json": json({ openapi: "3.1.0", paths: { "/screens": { get: { operationId: "listScreens", responses: { 200: { description: "ok" } } } } } }),
    "https://example.com/robots.txt": text("User-agent: *\nAllow: /\nUser-agent: GPTBot\nAllow: /\nContent-Signal: search=yes, ai-input=yes, ai-train=no\n"),
    "https://example.com/sitemap.xml": text("<urlset><url><loc>https://example.com/</loc></url></urlset>"),
    "https://example.com/.well-known/agent.json": json({ name: "Example" }),
    "https://example.com/.well-known/ai-plugin.json": json({ name_for_model: "example" }),
    "https://example.com/.well-known/agent-card.json": json({ name: "Example Agent" }),
    "https://example.com/.well-known/mcp/server-card.json": json({ name: "Example MCP", tools: [] }),
    "https://example.com/.well-known/mcp": text("MCP endpoint"),
    "https://example.com/?mode=agent": text("# Example Agent View\nAPI, auth, pricing, MCP, setup.")
  }) });

  const thin = await auditSite("https://thin.example", { fetcher: fixtureFetcher({
    "https://thin.example/": html({ title: "Thin", body: "<div id=\"root\"></div><script src=\"/app.js\"></script>".repeat(12) })
  }) });

  assert.ok(strong.score > thin.score);
  assert.ok(strong.score >= 75);
  assert.ok(thin.score < 40);
});

test("Markdown report includes score and prioritized recommendations", async () => {
  const result = await auditSite("https://thin.example", { fetcher: fixtureFetcher({
    "https://thin.example/": html({ title: "Thin", body: "<div id=\"root\"></div><script src=\"/app.js\"></script>".repeat(12) })
  }) });
  const md = renderMarkdownReport(result);
  assert.match(md, /Overall score:/);
  assert.match(md, /Highest-Leverage Recommendations/);
  assert.match(md, /AEO Research Lens Applied/);
  assert.match(md, /Publish a substantive \/llms\.txt/);
  assert.doesNotMatch(md, new RegExp(["Pro", "found"].join(""), "i"));
});

test("does not count a generic large marketing page as ?mode=agent", async () => {
  const largeMarketingPage = html({
    title: "Marketing",
    description: "A normal marketing page",
    body: `<main><h1>Marketing page</h1><p>${"AI product platform for teams. ".repeat(9000)}</p></main>`
  });
  const result = await auditSite("https://example.com", { fetcher: fixtureFetcher({
    "https://example.com/": largeMarketingPage,
    "https://example.com/?mode=agent": largeMarketingPage
  }) });

  const agentMode = result.evidence.surfaces.find((surface) => surface.key === "agentMode");
  assert.equal(agentMode.present, false);
});

test("rejects 200 homepage fallbacks for auxiliary surfaces", async () => {
  const homepage = html({
    title: "Fallback App",
    description: "Fallback app page",
    body: `<main><h1>Fallback App</h1><p>${"API pricing MCP auth SDK OpenAPI docs for agents. ".repeat(80)}</p></main>`
  });
  const result = await auditSite("https://fallback.example", { fetcher: async (url) => ({
    ok: true,
    status: 200,
    url: String(url),
    headers: new Map(Object.entries(homepage.headers)),
    text: async () => homepage.body
  }) });

  for (const surface of result.evidence.surfaces) {
    assert.equal(surface.present, false, `${surface.key} should not be counted from homepage fallback`);
  }
});

test("only credits Link headers that advertise machine-readable docs", async () => {
  const assetOnly = await auditSite("https://asset.example", { fetcher: fixtureFetcher({
    "https://asset.example/": html({
      title: "Asset Links",
      description: "A page with only preload links",
      headers: { link: "</assets/app.js>; rel=\"preload\"; as=\"script\"" },
      body: "<main><h1>Asset Links</h1><p>Product content.</p></main>"
    })
  }) });
  const agentDocs = await auditSite("https://docs.example", { fetcher: fixtureFetcher({
    "https://docs.example/": html({
      title: "Agent Links",
      description: "A page with agent doc links",
      headers: { link: "</llms.txt>; rel=\"alternate\"; type=\"text/plain\"" },
      body: "<main><h1>Agent Links</h1><p>Product content.</p></main>"
    })
  }) });

  assert.equal(assetOnly.evidence.agentDocLinkHeader, false);
  assert.equal(agentDocs.evidence.agentDocLinkHeader, true);
});

test("fetches auxiliary surfaces from the redirected homepage origin", async () => {
  const homepage = html({
    title: "Redirected",
    description: "Redirected canonical host",
    body: `<main><h1>Redirected</h1><p>${"Product software for agents and developers. ".repeat(80)}</p></main>`
  });
  const result = await auditSite("https://example.com", { fetcher: async (url) => {
    if (url === "https://example.com/") {
      return response("https://www.example.com/", 200, homepage.body, homepage.headers);
    }
    if (url === "https://www.example.com/llms.txt") {
      return response(url, 200, "Redirected product overview use cases pricing api docs mcp agents support ".repeat(3), { "content-type": "text/plain" });
    }
    return response(url, 404, "not found", { "content-type": "text/plain" });
  } });

  const llms = result.evidence.surfaces.find((surface) => surface.key === "llms");
  assert.equal(llms.present, true);
  assert.equal(llms.url, "https://www.example.com/llms.txt");
});

test("fetches auxiliary surfaces from a declared canonical host", async () => {
  const homepage = {
    status: 200,
    headers: { "content-type": "text/html" },
    body: `<!doctype html><html><head><title>Canonical Host</title><meta name="description" content="Canonical host"><link rel="canonical" href="https://www.example.com/"></head><body><main><h1>Canonical Host</h1><p>${"Product software for agents and developers. ".repeat(80)}</p></main></body></html>`
  };
  const result = await auditSite("https://example.com", { fetcher: async (url) => {
    if (url === "https://example.com/") return response(url, 200, homepage.body, homepage.headers);
    if (url === "https://www.example.com/llms.txt") return response(url, 200, "Canonical product overview use cases pricing api docs mcp agents support ".repeat(3), { "content-type": "text/plain" });
    return response(url, 404, "not found", { "content-type": "text/plain" });
  } });

  const llms = result.evidence.surfaces.find((surface) => surface.key === "llms");
  assert.equal(llms.present, true);
  assert.equal(llms.url, "https://www.example.com/llms.txt");
});

test("parses CLI options without treating option values as URLs", () => {
  assert.deepEqual(parseCliArgs(["--out", "reports", "https://example.com", "--json"]), {
    url: "https://example.com",
    outDir: "reports",
    jsonOnly: true,
    yes: false,
    help: false
  });
  assert.deepEqual(parseCliArgs(["https://example.com", "--out=reports"]), {
    url: "https://example.com",
    outDir: "reports",
    jsonOnly: false,
    yes: false,
    help: false
  });
  assert.deepEqual(parseCliArgs(["--out", "reports", "--yes"]), {
    url: null,
    outDir: "reports",
    jsonOnly: false,
    yes: true,
    help: false
  });
});

test("CLI direct-run guard handles npm bin symlinks", () => {
  const realPath = "/repo/bin/lazyweb-aeo-audit.mjs";
  const symlinkPath = "/repo/node_modules/.bin/lazyweb-aeo-audit";
  const realpath = (value) => value === symlinkPath ? realPath : value;

  assert.equal(isDirectRun(symlinkPath, pathToFileURL(realPath).href, realpath), true);
});

test("normalizes website input for interactive first run", () => {
  assert.equal(normalizeWebsiteInput("example.com"), "https://example.com/");
  assert.equal(normalizeWebsiteInput("http://example.com/pricing"), "http://example.com/pricing");
  assert.throws(() => normalizeWebsiteInput(""), /Missing website/);
});

test("infers website from project metadata", async () => {
  const files = new Map([
    ["/repo/package.json", JSON.stringify({
      homepage: "https://product.example",
      repository: { url: "https://github.com/acme/product" }
    })],
    ["/repo/README.md", "# Product\nhttps://docs.example"]
  ]);

  const result = await inferWebsiteFromProject("/repo", fakeReadText(files));
  assert.deepEqual(result, {
    url: "https://product.example/",
    source: "package.json homepage"
  });
});

test("infers README website while skipping repository and badge URLs", async () => {
  const files = new Map([
    ["/repo/package.json", "{}"],
    ["/repo/README.md", "# Product\nhttps://github.com/acme/product\nhttps://img.shields.io/badge/a-b\nhttps://app.example"]
  ]);

  const result = await inferWebsiteFromProject("/repo", fakeReadText(files));
  assert.deepEqual(result, {
    url: "https://app.example/",
    source: "README.md"
  });
});

test("does not award content points when homepage is blocked", async () => {
  const blockedBody = html({
    title: "Blocked Site",
    description: "Blocked interstitial",
    body: `<main><h1>Blocked Site</h1><section><h2>What</h2><p>${"Product software for developers and marketers with pricing, use cases, comparisons, FAQs, API docs, SDK, MCP, auth, rate limits, and 25 integrations. ".repeat(50)}</p></section><a href="/about">About</a><a href="/contact">Contact</a><a href="/privacy">Privacy</a></main>`
  }).body;
  const result = await auditSite("https://blocked.example", { fetcher: async (url) => {
    if (url === "https://blocked.example/") return response(url, 403, blockedBody, { "content-type": "text/html" });
    return response(url, 404, "not found", { "content-type": "text/plain" });
  } });

  assert.equal(result.categories.crawlability.score, 0);
  assert.equal(result.categories.entityTrust.score, 0);
  assert.equal(result.categories.answerability.score, 0);
  assert.equal(result.categories.integration.score, 0);
});

test("excludes fallback auxiliary bodies from integration docs scoring", async () => {
  const homepage = html({
    title: "Plain",
    description: "Plain marketing page",
    body: "<main><h1>Plain</h1><p>A simple product page for teams.</p></main>"
  });
  const fallbackDocs = "API docs auth rate limits SDK MCP OpenAPI schema ".repeat(30);
  const result = await auditSite("https://plain.example", { fetcher: async (url) => {
    if (url === "https://plain.example/") return response(url, 200, homepage.body, homepage.headers);
    if (url === "https://plain.example/openapi.json") return response("https://plain.example/", 200, fallbackDocs, { "content-type": "text/html" });
    if (url === "https://plain.example/.well-known/mcp") return response("https://plain.example/", 200, fallbackDocs, { "content-type": "text/html" });
    return response(url, 404, "not found", { "content-type": "text/plain" });
  } });

  assert.equal(result.evidence.surfaces.find((surface) => surface.key === "openapi").present, false);
  assert.equal(result.evidence.surfaces.find((surface) => surface.key === "wellKnownMcp").present, false);
  assert.equal(result.categories.integration.score, 0);
});

test("requires real OpenAPI operations", async () => {
  const homepage = html({
    title: "API Placeholder",
    description: "API placeholder",
    body: "<main><h1>API Placeholder</h1><p>Developer docs and API docs are available.</p></main>"
  });
  const result = await auditSite("https://api.example", { fetcher: fixtureFetcher({
    "https://api.example/": homepage,
    "https://api.example/openapi.json": json({ openapi: "3.1.0", paths: {} })
  }) });

  assert.equal(result.evidence.surfaces.find((surface) => surface.key === "openapi").present, false);
  assert.ok(result.recommendations.some((rec) => rec.title === "Publish OpenAPI or explain no public API"));
});

test("does not count malformed JSON-LD as valid structured data", async () => {
  const result = await auditSite("https://bad-jsonld.example", { fetcher: fixtureFetcher({
    "https://bad-jsonld.example/": html({
      title: "Bad JSON-LD",
      description: "Malformed structured data",
      body: `<main><h1>Bad JSON-LD</h1><p>${"Product software for teams. ".repeat(80)}</p></main><script type="application/ld+json">{bad</script>`
    })
  }) });

  assert.equal(result.evidence.homepage.jsonLdCount, 0);
  assert.equal(result.evidence.homepage.invalidJsonLdCount, 1);
  assert.ok(result.recommendations.some((rec) => rec.title === "Add schema.org JSON-LD identity"));
});

test("flags single-bundle app shells as JavaScript-heavy", async () => {
  const result = await auditSite("https://spa.example", { fetcher: fixtureFetcher({
    "https://spa.example/": {
      status: 200,
      headers: { "content-type": "text/html" },
      body: `<!doctype html><html><head><title>SPA</title><meta name="description" content="SPA"><link rel="canonical" href="https://spa.example/"></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>`
    }
  }) });

  assert.equal(result.evidence.homepage.jsHeavyRisk, true);
  assert.ok(result.categories.crawlability.notes.includes("raw HTML looks JavaScript-heavy or thin"));
});

test("does not credit canonical tags pointing to unrelated hosts", async () => {
  const result = await auditSite("https://canonical.example", { fetcher: fixtureFetcher({
    "https://canonical.example/": {
      status: 200,
      headers: { "content-type": "text/html" },
      body: `<!doctype html><html><head><title>Canonical</title><meta name="description" content="Canonical"><link rel="canonical" href="https://wrong.example/"></head><body><main><h1>Canonical</h1><h2>A</h2><h2>B</h2><p>${"Product software for teams. ".repeat(100)}</p></main></body></html>`
    }
  }) });

  assert.ok(result.categories.crawlability.notes.includes("canonical or index directives need review"));
});

test("rejects HTML responses for file-based machine-readable surfaces", async () => {
  const result = await auditSite("https://html-file.example", { fetcher: fixtureFetcher({
    "https://html-file.example/": html({
      title: "HTML File",
      description: "HTML file fallback",
      body: "<main><h1>HTML File</h1><p>Product page.</p></main>"
    }),
    "https://html-file.example/llms.txt": {
      status: 200,
      headers: { "content-type": "text/html" },
      body: "<!doctype html><html><body><h1>Not markdown</h1><p>overview use cases pricing api docs mcp agents support overview use cases pricing api docs mcp agents support</p></body></html>"
    }
  }) });

  assert.equal(result.evidence.surfaces.find((surface) => surface.key === "llms").present, false);
});

test("does not treat valid HTML pages with shared prefixes as homepage fallbacks", async () => {
  const sharedPrefix = `<header>${"<a href=\"/nav\">Navigation</a>".repeat(700)}</header>`;
  const homepage = html({
    title: "Shared Prefix",
    description: "Shared prefix homepage",
    body: `${sharedPrefix}<main><h1>Shared Prefix</h1><p>${"Product software for teams and developers. ".repeat(80)}</p></main>`
  });
  const pricing = html({
    title: "Pricing",
    description: "Shared prefix pricing",
    body: `${sharedPrefix}<main><h1>Pricing</h1><p>${"Pricing plans include Free, Pro at $29 per month, and Enterprise. ".repeat(20)}</p></main>`
  });
  const result = await auditSite("https://shared-prefix.example", { fetcher: fixtureFetcher({
    "https://shared-prefix.example/": homepage,
    "https://shared-prefix.example/pricing": pricing
  }) });

  assert.equal(result.evidence.surfaces.find((surface) => surface.key === "pricing").present, true);
});

test("parses valid JSON-LD containing literal HTML entity text", async () => {
  const result = await auditSite("https://entity-jsonld.example", { fetcher: fixtureFetcher({
    "https://entity-jsonld.example/": html({
      title: "Entity JSON-LD",
      description: "Entity JSON-LD",
      body: `<main><h1>Entity JSON-LD</h1><p>${"Product software for teams. ".repeat(80)}</p></main><script type="application/ld+json; charset=utf-8">{"@context":"https://schema.org","@type":"Organization","name":"Use &quot;AI&quot;"}</script>`
    })
  }) });

  assert.equal(result.evidence.homepage.jsonLdCount, 1);
  assert.equal(result.evidence.homepage.invalidJsonLdCount, 0);
  assert.deepEqual(result.evidence.homepage.schemaTypes, ["Organization"]);
});

function fixtureFetcher(map) {
  return async (url) => {
    const key = String(url);
    const value = map[key] || { status: 404, body: "not found", headers: {} };
    return {
      ok: value.status >= 200 && value.status < 300,
      status: value.status,
      url: key,
      headers: new Map(Object.entries(value.headers || {})),
      text: async () => value.body
    };
  };
}

function fakeReadText(files) {
  return async (path) => {
    if (!files.has(path)) {
      const error = new Error(`ENOENT: ${path}`);
      error.code = "ENOENT";
      throw error;
    }
    return files.get(path);
  };
}

function response(url, status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    headers: new Map(Object.entries(headers)),
    text: async () => body
  };
}

function html({ title = "Untitled", description = "", body = "", headers = {} }) {
  return {
    status: 200,
    headers: { "content-type": "text/html", link: "</llms.txt>; rel=\"alternate\"; type=\"text/plain\"", ...headers },
    body: `<!doctype html><html><head><title>${title}</title><meta name="description" content="${description}"><link rel="canonical" href="https://example.com/"></head><body>${body}</body></html>`
  };
}

function text(body) {
  return { status: 200, headers: { "content-type": "text/plain" }, body };
}

function json(value) {
  return { status: 200, headers: { "content-type": "application/json" }, body: JSON.stringify(value) };
}
