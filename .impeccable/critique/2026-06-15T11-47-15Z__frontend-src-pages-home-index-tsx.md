---
target: prediction page
total_score: 17
p0_count: 0
p1_count: 3
timestamp: 2026-06-15T11-47-15Z
slug: frontend-src-pages-home-index-tsx
---
# Prediction Page Critique

Target: `frontend/src/pages/Home/index.tsx` (`MatchDetail` currently returns `Home`)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | "Live" and "Last updated" are visible, but repeated and not backed by loading, stale, refresh, or error states. |
| 2 | Match System / Real World | 2 | Football concepts are recognizable, but brand, round, and timing language conflict across the page. |
| 3 | User Control and Freedom | 1 | Primary controls mostly do not complete an action: Match Info, View all, bottom nav, and chat submit feel inert. |
| 4 | Consistency and Standards | 2 | Futbolia, WORLDIAN, light theme, dark design spec, duplicated confidence, and green-tinted highlighted rows conflict. |
| 5 | Error Prevention | 1 | No validation, disabled, empty, loading, stale, or confirmation states for high-stakes prediction/chat actions. |
| 6 | Recognition Rather Than Recall | 3 | Labels and values are readable, but the meaning of confidence, edge, and movement is underexplained. |
| 7 | Flexibility and Efficiency | 2 | Prompt chips help, but there is no market filter, sort, pinned summary, market selector, or quick path to reasoning. |
| 8 | Aesthetic and Minimalist Design | 2 | Polished at a glance, but the hero art, repeated cards, and dense tiles delay the product's main reasoning task. |
| 9 | Error Recovery | 1 | No recovery path exists for chat failure, stale model data, missing market data, or disconnected live updates. |
| 10 | Help and Documentation | 1 | Info icons and Match Info suggest help, but there are no explanations, tooltips, or trust notes near the decision. |
| **Total** | | **17/40** | **Functional prototype with major product hierarchy and interaction gaps** |

## Anti-Patterns Verdict

LLM assessment: This does not look broken, but it does read like an AI-generated sports analytics dashboard in places. The largest tells are the oversized decorative hero, the repeated soft-card system, duplicated "Live" badges, identical market card grid, uppercase labels everywhere, and a generic signal strip that delays the actual model reasoning.

Deterministic scan: `detect.mjs --json frontend/src/pages/Home frontend/src/components/Header frontend/src/layouts/AppShell` returned `[]`. The detector did not flag slop patterns. Manual review still found product-level issues that the detector is not designed to catch: hierarchy, dead interactions, brand/spec mismatch, and mobile ordering.

Visual overlays: No reliable user-visible overlay is available. Browser mutation preflight failed when trying to set `document.title` and append a script: "Cannot set property title of [object Object] which has only a getter." Browser evidence falls back to screenshots, DOM measurements, and CLI detector output.

## Overall Impression

The page gives users "Brazil 58%, confidence 8.2" quickly on desktop, which is the right first anchor. It fails the next job: explaining why the model believes that and what changed. On mobile, the AI reasoning panel starts around 4,846 px down the page, after the match hero, probability card, signal strip, conditions, and every market card.

## What's Working

- The probability card is legible. The 58/21/21 split, confidence, and current winner are clear above the fold on desktop.
- The information ingredients are right: probability, confidence, signals, markets, movement, feed, and chat all exist.
- The visual system has consistent spacing and enough contrast for most visible text; there was no horizontal overflow at 390 px mobile width.

## Priority Issues

**[P1] Reasoning is structurally below analytics**

Why it matters: The product brief says "Reasoning Before Analytics" and users should understand "why" within five seconds. The page puts `AI Reasoning` after the hero, probability card, signal strip, and market grid (`frontend/src/pages/Home/index.tsx:353`, `frontend/src/pages/Home/index.tsx:419`, `frontend/src/pages/Home/index.tsx:463`). Browser measurement placed `AI Reasoning` below the fold on desktop and around 4,846 px down on mobile.

Fix: Recompose the first screen around a compact prediction summary: winner, confidence, top 3 drivers, last change, and one primary market. Move full markets and conditions below. On mobile, put "Why Brazil is favored" immediately after the probability result, before markets.

Suggested command: `$impeccable layout prediction page`

**[P1] Mobile reading order turns the prediction into a long report**

Why it matters: At 390 x 844, the match hero alone consumes most of the first viewport, the probability card starts under the sticky nav, and the reasoning is far below. A live match user will not scroll through every market tile to find the explanation.

Fix: Collapse the hero on mobile to a compact match header, make the probability card first-class, move reasoning directly under it, and reserve the sticky bottom nav space with bottom padding. The current mobile rules increase `.matchHero` to 520 px and make grids single-column (`frontend/src/pages/Home/Home.module.scss:1033`, `frontend/src/pages/Home/Home.module.scss:1054`), while the sticky nav overlays content (`frontend/src/pages/Home/Home.module.scss:1086`).

Suggested command: `$impeccable adapt prediction page`

**[P1] Interactions promise action but do not deliver**

Why it matters: Inert controls break trust in a prediction product. `Match Info`, `View all`, the bottom nav anchors, and chat submit are presented as working commands, but chat only clears the input (`frontend/src/pages/Home/index.tsx:259`), market footers are plain buttons (`frontend/src/pages/Home/index.tsx:456`), and bottom nav links target missing sections such as `#live`, `#bets`, `#alerts`, and `#profile` (`frontend/src/pages/Home/index.tsx:578`).

Fix: Either wire the actions or downgrade them to non-interactive labels. Chat submit should add a pending user message, loading AI response, success/failure state, and recovery. `View all` should expand/route. Bottom nav should point to real sections or be removed on desktop.

Suggested command: `$impeccable harden prediction page`

**[P2] Product identity and data contract are inconsistent**

Why it matters: The product context and `DESIGN.md` say Futbolia, but the header says WORLDIAN (`frontend/src/components/Header/index.tsx:20`). `DESIGN.md` says dark mode by default (`frontend/DESIGN.md:52`), while the committed variables are a pale light theme (`frontend/src/styles/abstracts/_variables.scss:1`). The breadcrumb says Quarter Finals while the match data says Semi Final (`frontend/src/pages/Home/index.tsx:270`, `frontend/src/pages/Home/index.tsx:292`).

Fix: Decide whether this is Futbolia or Worldian and whether the product is light or dark. Then bind visible copy to one data source. Avoid hard-coded market, insight, and condition values when matching Redux data exists.

Suggested command: `$impeccable clarify prediction page`

**[P2] Market cards are dense, repetitive, and semantically muddy**

Why it matters: Eight same-shape cards make the market area feel like a sportsbook wall instead of an AI reasoning engine. Highlighted rows always get a green-tinted background even when the row tone is blue or red (`frontend/src/pages/Home/index.tsx:441`, `frontend/src/pages/Home/Home.module.scss:964`), which weakens risk and direction semantics.

Fix: Prioritize 3-4 "markets worth attention" with reason, edge, risk, and confidence. Put the rest behind tabs or filters. Make row tint follow semantic tone, and include direction/magnitude/cause for changes.

Suggested command: `$impeccable distill prediction page`

## Persona Red Flags

**Jordan, first-time football fan**: Sees Brazil is favored but does not know why until much later. "AI Confidence 8.2" and "Model Momentum +2.1%" lack plain-language meaning. Match Info looks like the help path but does nothing.

**Mina, prediction-market user**: Wants edge, risk, movement, and market opportunity. The market grid has probabilities but no market consensus, edge confidence, liquidity, risk explanation, or sortable priority. "View all" buttons do not reveal anything.

**Alex, live analyst**: Needs freshness and fast scanning. "Live" appears in many places, but there is no stale state, refresh event, update cause, or confidence history. On mobile, the signal hierarchy forces excessive scrolling during a time-sensitive moment.

## Minor Observations

- Two visible `h1` elements are used for team names; a single match-level heading would be cleaner for document structure.
- The hero has strong visual presence but does not carry decision value proportional to its space.
- `MatchDetail` is only a wrapper around `Home`, so route-specific match detail behavior is not represented yet.
- The responsible betting note appears at the bottom of chat, far from markets and probability decisions.
- The bottom nav appears on desktop as an in-page section after the content, but behaves as a sticky app nav on mobile.

## Questions to Consider

- What would the page look like if the first screen were "Prediction + Why + Latest change" instead of "Match poster + probability card"?
- Which three markets should the AI recommend, and which markets should be hidden until requested?
- Is this product meant to feel like premium dark sports analysis or a lighter approachable dashboard? The current code and design spec disagree.
