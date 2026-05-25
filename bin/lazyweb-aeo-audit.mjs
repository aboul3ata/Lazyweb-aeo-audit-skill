#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { auditSite, writeReportFiles } from "../lib/audit.mjs";
import { fileURLToPath } from "node:url";

export function parseCliArgs(args) {
  const parsed = { url: null, outDir: null, jsonOnly: false };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      parsed.jsonOnly = true;
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

  if (!parsed.url) throw new Error("Missing URL");
  return parsed;
}

async function main(args) {
  let parsed;
  try {
    parsed = parseCliArgs(args);
  } catch (error) {
    console.error(error.message);
    console.error("Usage: lazyweb-aeo-audit <url> [--out reports] [--json]");
    process.exit(1);
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
