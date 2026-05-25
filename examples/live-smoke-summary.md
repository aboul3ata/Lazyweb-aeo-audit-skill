# Live Smoke Summary

Last run: 2026-05-25

Command:

```bash
npm run test:live
```

The live smoke audits `lazyweb.com` plus nine representative product/company sites. Full generated reports are written to `reports/live-smoke/` and intentionally ignored by git.

| URL | Score | Grade | Top recommendation |
|---|---:|---|---|
| https://lazyweb.com | 47 | F | Make raw HTML answer what the product does |
| https://www.figma.com | 69 | D | Publish a substantive `/llms.txt` |
| https://www.openai.com | 3 | F | Make the homepage fetchable by standard agents |
| https://www.anthropic.com | 60 | D | Publish a substantive `/llms.txt` |
| https://linear.app | 70 | C | Add `/pricing.md` for agent plan comparison |
| https://www.notion.com | 67 | D | Add `/pricing.md` for agent plan comparison |
| https://cursor.com | 80 | B | Add `/pricing.md` for agent plan comparison |
| https://vercel.com | 75 | C | Add `/pricing.md` for agent plan comparison |
| https://stripe.com | 73 | C | Add `/pricing.md` for agent plan comparison |
| https://supabase.com | 82 | B | Add a dedicated `?mode=agent` view |

Validation notes:

- The tool successfully produced a score and Markdown/JSON report for every target.
- `openai.com` returned HTTP 403 to the audit fetch path; the report correctly surfaces fetchability as the first issue rather than treating missing raw HTML as normal AEO content.
- Sites with strong raw HTML and agent-readable documentation, such as Supabase, Cursor, and Vercel, scored higher than JS-thin or blocked sites.
- Auxiliary surface detection rejects homepage fallbacks and generic asset `Link` headers; blocked homepages and thin app shells are now scored conservatively.
