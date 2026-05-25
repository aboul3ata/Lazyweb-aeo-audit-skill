#!/usr/bin/env node
import { auditSite, writeReportFiles } from "../lib/audit.mjs";

const urls = [
  "https://lazyweb.com",
  "https://www.tryprofound.com",
  "https://www.openai.com",
  "https://www.anthropic.com",
  "https://linear.app",
  "https://www.notion.com",
  "https://cursor.com",
  "https://vercel.com",
  "https://stripe.com",
  "https://supabase.com"
];

const outDir = "reports/live-smoke";
const rows = [];

for (const url of urls) {
  const result = await auditSite(url, { timeoutMs: 20000 });
  await writeReportFiles(result, outDir);
  rows.push({ url, score: result.score, grade: result.grade, recommendations: result.recommendations.length });
  console.log(`${url} -> ${result.score}/100 (${result.grade}), ${result.recommendations.length} recommendations`);
}

const failures = rows.filter((row) => !Number.isFinite(row.score) || row.score < 0 || row.score > 100);
if (failures.length) {
  console.error("Invalid score rows:", failures);
  process.exit(1);
}

