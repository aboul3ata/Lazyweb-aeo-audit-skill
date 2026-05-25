#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { auditSite, writeReportFiles } from "../lib/audit.mjs";
import { fileURLToPath } from "node:url";

export function parseCliArgs(args) {
  const parsed = { url: null, outDir: null, jsonOnly: false, yes: false, help: false };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      parsed.jsonOnly = true;
    } else if (arg === "--yes" || arg === "-y") {
      parsed.yes = true;
    } else if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--out") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--out requires a directory value");
      parsed.outDir = value;
      index += 1;
    } else if (arg.startsWith("--out=")) {
      const value = arg.slice("--out=".length);
      if (!value) throw new Error("--out requires a directory value");
      parsed.outDir = value;
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (!parsed.url) {
      parsed.url = arg;
    } else {
      throw new Error(`Unexpected extra argument: ${arg}`);
    }
  }

  return parsed;
}

async function main(args) {
  let parsed;
  try {
    parsed = parseCliArgs(args);
  } catch (error) {
    console.error(error.message);
    printUsage(console.error);
    process.exit(1);
  }

  if (parsed.help) {
    printUsage(console.log);
    process.exit(0);
  }

  if (!parsed.url) {
    try {
      parsed = await promptForAudit(parsed);
    } catch (error) {
      console.error(error.message);
      process.exit(1);
    }
    if (!parsed) return;
  }

  const result = await auditSite(parsed.url);

  if (parsed.outDir) {
    const files = await writeReportFiles(result, parsed.outDir);
    if (!parsed.jsonOnly) {
      console.log(`Score: ${result.score}/100 (${result.grade})`);
      console.log(`Markdown report: ${files.mdPath}`);
      console.log(`JSON evidence: ${files.jsonPath}`);
    }
  }

  if (parsed.jsonOnly || !parsed.outDir) {
    console.log(JSON.stringify(result, null, 2));
  }
}

async function promptForAudit(parsed) {
  const inferred = await inferWebsiteFromProject();
  const scriptedAnswers = stdin.isTTY ? null : await readScriptedAnswers(stdin);
  const rl = scriptedAnswers ? null : createInterface({ input: stdin, output: stdout });
  const question = scriptedAnswers
    ? async (prompt) => {
      stdout.write(prompt);
      return scriptedAnswers.shift() ?? "";
    }
    : (prompt) => rl.question(prompt);

  try {
    const inferredSuffix = inferred ? ` [${inferred.url}]` : "";
    const sourceSuffix = inferred ? ` (inferred from ${inferred.source})` : "";
    const answer = await question(`Website to audit${inferredSuffix}${sourceSuffix}: `);
    const rawUrl = answer.trim() || inferred?.url;

    if (!rawUrl) {
      throw new Error("No website provided.");
    }

    let url;
    try {
      url = normalizeWebsiteInput(rawUrl);
    } catch {
      throw new Error(`Invalid website URL: ${rawUrl}`);
    }

    if (!parsed.yes) {
      const confirmation = await question(`Run an AEO audit report for ${url}? [y/N]: `);
      if (!isYes(confirmation)) {
        console.log("Audit canceled.");
        return null;
      }
    }

    return { ...parsed, url, outDir: parsed.outDir || "reports" };
  } finally {
    rl?.close();
  }
}

async function readScriptedAnswers(input) {
  const chunks = [];
  for await (const chunk of input) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8").split(/\r?\n/);
}

export async function inferWebsiteFromProject(cwd = process.cwd(), readText = readFile) {
  const packageCandidate = await inferFromPackageJson(cwd, readText);
  if (packageCandidate) return packageCandidate;

  const cnameCandidate = await inferFromCname(cwd, readText);
  if (cnameCandidate) return cnameCandidate;

  const readmeCandidate = await inferFromReadme(cwd, readText);
  if (readmeCandidate) return readmeCandidate;

  return null;
}

async function inferFromPackageJson(cwd, readText) {
  const text = await readOptionalText(readText, join(cwd, "package.json"));
  if (!text) return null;

  try {
    const pkg = JSON.parse(text);
    for (const [field, value] of [
      ["homepage", pkg.homepage],
      ["website", pkg.website],
      ["url", pkg.url]
    ]) {
      const url = normalizeWebsiteCandidate(value);
      if (url) return { url, source: `package.json ${field}` };
    }
  } catch {
    return null;
  }

  return null;
}

async function inferFromCname(cwd, readText) {
  const text = await readOptionalText(readText, join(cwd, "CNAME"));
  const domain = text?.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  const url = normalizeWebsiteCandidate(domain);
  return url ? { url, source: "CNAME" } : null;
}

async function inferFromReadme(cwd, readText) {
  const text = await readOptionalText(readText, join(cwd, "README.md"));
  if (!text) return null;

  for (const match of text.matchAll(/https?:\/\/[^\s)"'<>]+/gi)) {
    const url = normalizeWebsiteCandidate(match[0]);
    if (url) return { url, source: "README.md" };
  }

  return null;
}

async function readOptionalText(readText, path) {
  try {
    return await readText(path, "utf8");
  } catch {
    return "";
  }
}

export function normalizeWebsiteInput(input) {
  const value = String(input || "").trim();
  if (!value) throw new Error("Missing website");
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const url = new URL(withProtocol);
  return url.href;
}

function normalizeWebsiteCandidate(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = normalizeWebsiteInput(stripTrailingPunctuation(value));
    return isWebsiteCandidate(url) ? url : null;
  } catch {
    return null;
  }
}

function stripTrailingPunctuation(value) {
  return value.trim().replace(/[),.;:]+$/g, "");
}

function isWebsiteCandidate(urlValue) {
  try {
    const url = new URL(urlValue);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") return false;
    if (host.endsWith("github.com")) return false;
    if (host.endsWith("githubusercontent.com")) return false;
    if (host.endsWith("gitlab.com")) return false;
    if (host.endsWith("bitbucket.org")) return false;
    if (host.endsWith("npmjs.com")) return false;
    if (host.endsWith("shields.io")) return false;
    return true;
  } catch {
    return false;
  }
}

function isYes(value) {
  return /^(y|yes)$/i.test(String(value || "").trim());
}

function printUsage(print) {
  print(`Usage: lazyweb-aeo-audit [url] [--out reports] [--json] [--yes]

Run without a URL for the guided first-run flow:
  lazyweb-aeo-audit

Run directly when you already know the website:
  lazyweb-aeo-audit https://example.com --out reports`);
}

export function isDirectRun(argvPath = process.argv[1], moduleUrl = import.meta.url, realpath = realpathSync) {
  if (!argvPath) return false;
  try {
    return realpath(argvPath) === realpath(fileURLToPath(moduleUrl));
  } catch {
    return argvPath === fileURLToPath(moduleUrl);
  }
}

if (isDirectRun()) {
  await main(process.argv.slice(2));
}
