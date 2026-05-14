# Audit Note — AISEOContentWriter

## Original audit recommendations (batch_07.md §28)

**Missing AI endpoints:** `/generate-content`, `/keyword-research`, `/content-outline`, `/seo-optimization`, `/competitor-analysis`, `/backlink-opportunity`.

**Missing non-AI features:** project/article management, keyword tracking, competitor URL management, publishing workflow, GA/Search Console integration.

**Custom suggestions:** end-to-end AI writer, content calendar planner, competitor analyzer, long-form pillar+cluster, SEO audit, intent matching.

Note: audit said "0 AI endpoints" / "skeleton"; reality has 16+ AI endpoints (`/keyword-research`, `/content-generation`, `/meta-tags`, `/seo-audit`, `/backlink-analysis`, `/content-optimizer`, `/serp-analysis`, `/competitor-analysis`, `/title-generator`, `/blog-posts`, `/product-descriptions`, `/faq-generator`, `/schema-markup`, `/content-calendar`, `/readability-analysis`) plus full CRUD via factory.

## Implemented this pass (3 mechanical)
1. `POST /api/ai/content-outline` — structured outline (title, meta, h1, sections with h2/h3/bullets/keywords, FAQ, CTA).
2. `POST /api/ai/backlink-opportunity` — strategy AI for link-building opportunities (guest post, broken link, HARO, etc.) with outreach templates.
3. `POST /api/ai/intent-matcher` — search-intent classification + cluster + cannibalization risk.

All three reuse `callOpenRouter`, `parseAIJson`, `auth`, `aiRateLimiter`. Syntax-checked.

## Backlog (prioritized)
1. Persist outlines / opportunities / intent maps to dedicated models (mechanical follow-up).
2. GA / Search Console integration (NEEDS-CREDS).
3. Publishing workflow (CMS adapters) (NEEDS-PRODUCT-DECISION).
4. Long-form pillar+cluster orchestration agent (mechanical follow-up over existing endpoints).

## Apply pass 3 (frontend)

- Stack: CRA-style React client, Express server.
- Apply-pass-2 endpoints (`/api/ai/content-outline`,
  `/api/ai/backlink-opportunity`, `/api/ai/intent-matcher`) each have a
  dedicated page already:
  - `client/src/pages/ContentOutlinePage.js`
  - `client/src/pages/BacklinkOpportunityPage.js`
  - `client/src/pages/IntentMatcherPage.js`
- Action: **LEFT-AS-IS** — frontend is already wired (idempotence rule).
- No files changed this pass.

## Apply pass 4 (mechanical backlog)

- Action: **NO-OP** — backend AI surface (`/ai/content-outline`,
  `/ai/backlink-opportunity`, `/ai/intent-matcher`,
  `/ai/pillar-cluster-orchestration`, `/ai/content-gap-analyzer`,
  `/ai/internal-link-suggester`) all 503 on no key and have matching
  FE pages (`ContentOutlinePage`, `BacklinkOpportunityPage`,
  `IntentMatcherPage`, `PillarClusterOrchestrationPage`,
  `ContentGapAnalyzerPage`, `InternalLinkSuggesterPage`) wired in
  `App.js` and `Layout.js`.
- The audit's two outstanding canonical names — `/generate-content`
  and `/seo-optimization` — already exist under the project's house
  naming as `/ai/content-generation` and `/ai/content-optimizer` (with
  persistence + readability + keyword-density). Adding pure aliases
  would be churn without product value; deliberately skipped.
- Remaining backlog: persist outlines / opportunities / intent maps
  to dedicated Sequelize models (mechanical but requires schema +
  migration — out of scope for an "AI Center tab" pass), GA / Search
  Console (NEEDS-CREDS), publishing CMS adapters (NEEDS-PRODUCT-DECISION).
- No files changed this pass.
