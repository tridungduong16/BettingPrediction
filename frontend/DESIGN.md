---
name: Worldian Frontend
description: AI World Cup prediction dashboard focused on fast match confidence, reasoning, and market signals.
colors:
  bg-primary: "#030816"
  bg-secondary: "#08111f"
  card: "#0a1526"
  card-hover: "#0f2138"
  surface-raised: "#0e2037"
  border: "#20324c"
  border-strong: "#3a5276"
  text-primary: "#f5f8ff"
  text-secondary: "#aebbd0"
  text-muted: "#718096"
  success: "#20e66b"
  warning: "#ff8a1f"
  danger: "#ff554a"
  info: "#3483ff"
  ai-accent: "#9a5cff"
  info-soft: "#93c5fd"
  status-info-soft: "#c8dcff"
  status-warning-soft: "#ffd98d"
  probability-neutral: "#b8c2d2"
  white: "#ffffff"
  google-text: "#1f2937"
typography:
  display:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "56px"
    fontWeight: 950
    lineHeight: 1.08
    letterSpacing: "0"
  headline:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "34px"
    fontWeight: 950
    lineHeight: 1
    letterSpacing: "0"
  title:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "26px"
    fontWeight: 950
    lineHeight: 1.15
    letterSpacing: "0"
  body:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  label:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "12px"
    fontWeight: 850
    lineHeight: 1.2
    letterSpacing: "0"
  metric:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "30px"
    fontWeight: 950
    lineHeight: 1
    letterSpacing: "0"
rounded:
  sm: "8px"
  md: "10px"
  lg: "14px"
  xl: "16px"
  pill: "999px"
spacing:
  space-1: "4px"
  space-2: "8px"
  space-3: "12px"
  space-4: "16px"
  space-5: "20px"
  space-6: "24px"
  space-8: "32px"
  space-10: "40px"
  space-12: "48px"
  space-16: "64px"
components:
  button-primary:
    backgroundColor: "{colors.ai-accent}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "#7c3aed"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "44px"
  button-google:
    backgroundColor: "{colors.text-primary}"
    textColor: "{colors.google-text}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 16px 0 12px"
    height: "44px"
  input-search:
    backgroundColor: "{colors.bg-secondary}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "44px"
  panel-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.xl}"
    padding: "20px"
  market-card:
    backgroundColor: "{colors.bg-secondary}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "16px"
  live-badge:
    backgroundColor: "#0b2a1c"
    textColor: "{colors.success}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "27px"
---

# Design System: Worldian Frontend

## 1. Overview

**Creative North Star: "The Match Intelligence Desk"**

Worldian is a dark, premium sports intelligence product for time-sensitive football prediction decisions. The interface should feel like an AI reasoning desk: immediate winner signal first, then confidence, model rationale, probability movement, and market opportunities. It is not a sportsbook, not a trading terminal, and not a generic analytics dashboard.

The current UI uses a restrained dark navy shell, high-contrast Inter typography, compact information panels, and semantic green, blue, orange, red, and violet signals. Color is functional: green confirms positive or live state, blue carries system information, violet marks AI reasoning, orange warns, and red flags risk. The product can use rich football imagery and video in hero surfaces, but the working dashboard stays task-first.

Density is allowed when it helps a user answer the five-second questions: who is favored, how confident the model is, why the model believes that, what changed, and which markets deserve attention. Repeated cards, tables, charts, chat bubbles, and timeline events must share the same border, radius, focus, and typography vocabulary.

**Key Characteristics:**
- Dark navy analytical canvas with restrained accent usage.
- Prediction first, reasoning second, market detail third.
- Compact panels with 8-16px radii and subtle tonal gradients.
- Semantic state colors that never carry meaning alone.
- 44px minimum touch targets on buttons, nav items, inputs, and mobile controls.
- Responsive structure: side navigation collapses, data tables become stacked cards, and live rails stop being sticky on narrow viewports.

**The Desk-First Rule.** Every screen must make the current AI opinion legible before exposing secondary analytics. If a user cannot identify the likely outcome and confidence within five seconds, the hierarchy is wrong.

## 2. Colors

The palette is a restrained dark product system: near-black navy foundations, cool blue-gray borders, bright text, and small semantic accents for live prediction signals.

### Primary

- **Deep Match Navy** (`colors.bg-primary`): The page canvas and app background. Use it for the body, full-screen loading overlay, and dark hero overlays.
- **AI Violet** (`colors.ai-accent`): The AI reasoning accent. Use it for AI labels, chat send actions, selected market cards, confidence rings, and reasoning highlights. It should stay rare enough to signal "model intelligence."
- **Signal Blue** (`colors.info`): System information, active nav, links, search focus, chart away lines, and neutral live state. It is the main interactive/system accent.

### Secondary

- **Live Green** (`colors.success`): Positive movement, live status, selected winner confidence, home probability lines, completed/healthy states, and high-confidence meters.
- **Market Orange** (`colors.warning`): Draw probability, caution states, provider errors, and medium-risk market indicators.
- **Risk Red** (`colors.danger`): Negative movement, high-risk labels, alerts, and destructive or failed states.

### Neutral

- **Panel Navy** (`colors.card`): Default panel and card base.
- **Hover Navy** (`colors.card-hover`): Hovered cards, raised hover surfaces, and subtle input/legend fills.
- **Secondary Surface** (`colors.bg-secondary`): Search fields, chat bubbles, chart wells, market cards, and embedded table rows.
- **Raised Surface** (`colors.surface-raised`): Hero and higher-emphasis dashboard panels.
- **Cool Border** (`colors.border`): Default 1px panel, card, input, divider, table, and chart boundary.
- **Strong Border** (`colors.border-strong`): Hovered card boundaries and selected/active surface edges.
- **Primary Ink** (`colors.text-primary`): All essential labels, values, headings, and interactive text.
- **Secondary Ink** (`colors.text-secondary`): Body copy, supporting metadata, and explanatory text.
- **Muted Ink** (`colors.text-muted`): Axis labels, timestamps, placeholders, and non-primary metadata only.

**The Accent Means State Rule.** Do not use green, orange, red, blue, or violet as decoration. Each accent must describe state, source, prediction direction, risk, or AI reasoning.

**The Dark Canvas Rule.** Keep the primary interface on `colors.bg-primary` and `colors.card`. Light surfaces are allowed only for third-party branded controls such as the Google sign-in button.

## 3. Typography

**Display Font:** Inter with system-ui, -apple-system, BlinkMacSystemFont, and Segoe UI fallbacks.
**Body Font:** Inter with the same fallback stack.
**Label/Mono Font:** Inter only; there is no separate mono face in the current UI.

**Character:** The type system is dense, numeric, and confident. It favors heavy values and uppercase labels for scan speed, while keeping body text compact and readable.

### Hierarchy

- **Display** (950, `typography.display`, 1.08): Match-list hero headlines and marketing-sized home hero copy only. It may clamp down responsively in code, but the desktop ceiling is the display token.
- **Headline** (950, `typography.headline`, 1): Winner statements, match-center scores, and major prediction declarations.
- **Title** (950, `typography.title`, 1.15): Section intros and dashboard section headings.
- **Body** (400-750, `typography.body`, 1.5-1.7): Explanatory reasoning, market descriptions, chat messages, source strips, and insight summaries. Long prose should stay under 72ch.
- **Label** (800-950, `typography.label`, uppercase where useful): Eyebrows, table headers, risk chips, timestamps, nav labels, live badges, and compact metadata.
- **Metric** (950, `typography.metric`, 1): Percentages, confidence scores, market edge values, and result numbers.

**The One Family Rule.** Do not introduce display, serif, mono, or decorative fonts. Product familiarity matters more than typographic novelty.

**The Number Weight Rule.** Probability, confidence, score, and edge values must be heavier than surrounding copy. A weak number is a weak prediction.

## 4. Elevation

Worldian uses tonal layering first and shadow second. Most depth comes from darker/lighter navy surfaces, 1px borders, gradient overlays, inset lines, and sticky positioning. Shadows are reserved for hero cards, loading overlays, flag frames, match cards, and brand/auth controls where separation is required.

### Shadow Vocabulary

- **Panel Rest** (`box-shadow: 0 8px 8px rgba(0, 0, 0, 0.12)`): Dashboard panels such as winner, probability, reasoning, edge, movement, live rail, and match stage containers.
- **Hero Lift** (`box-shadow: 0 18px 45px rgba(0, 0, 0, 0.18)`): Large visual match-list hero surfaces.
- **Loading Modal Lift** (`box-shadow: 0 18px 44px rgba(0, 0, 0, 0.34)`): Blocking loading card only.
- **Flag Lift** (`box-shadow: 0 18px 40px rgba(0, 0, 0, 0.22)`): Flag frames and important media inside match hero surfaces.
- **Google Control Lift** (`box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18)`): Third-party auth button in the sticky header.

**The Flat-By-Default Rule.** A normal card gets a border and tonal fill before it gets a shadow. If every card floats, the dashboard becomes noisy.

**The Sticky Layer Rule.** Sticky header, left panel, and live rail may use blur or fixed top offsets, but they must retain solid borders and readable contrast while content scrolls beneath them.

## 5. Components

### Buttons

- **Shape:** Compact rounded rectangles for product actions (`rounded.sm` or `rounded.md`), full pills only for auth, language, prompt, live, and status controls (`rounded.pill`).
- **Primary:** AI action buttons use `colors.ai-accent`, 44px height, 12px horizontal padding, heavy 12px labels, and white/primary text.
- **Positive action:** Match actions use green text over a transparent green tonal fill. They are state/action controls, not decorative CTAs.
- **Google auth:** The Google button is intentionally light, pill-shaped, and branded. Keep the 44px height, white fill, dark text, and small shadow.
- **Hover / Focus:** Hover changes background/border in 160ms and may translate up by 1px for auth only. Focus must use the shared 2px blue outline with 2px offset.
- **Disabled / Loading:** Disabled controls lower opacity to about 0.58-0.68 and stop transforms. Loading controls may show wait cursor or status text, not decorative spinners inside every button.

### Chips

- **Style:** Chips are compact pills with semantic tonal fills, 11-13px heavy text, and min-heights from 22px to 36px.
- **Live/state chips:** Use green for live/healthy, orange for provider error, blue for unmapped/info, and muted gray for not configured.
- **Risk chips:** Low risk is green, medium is orange, high is red. Keep label text uppercase and do not rely on color alone; include the risk word.
- **Prompt chips:** Chat prompt suggestions are transparent pills with cool borders, 44px minimum touch height, and hover fill from `colors.card-hover`.

### Cards / Containers

- **Corner Style:** Standard panels use 14-16px radii (`rounded.lg` or `rounded.xl`); compact embedded cards and inputs use 8-10px.
- **Background:** Use `colors.card` or `colors.bg-secondary` with subtle navy gradients for high-priority panels. Do not introduce bright full-surface cards.
- **Border:** Default border is `colors.border`. Hover/selected cards move toward `colors.border-strong`, blue, or violet depending on state.
- **Internal Padding:** Use 16px for compact cards, 20px for dashboard panels, 24px for dense analytical panels, and 32px for major hero panels.
- **Signature detail:** Prediction cards may use the 2px top gradient line from violet to blue to green. Do not reuse that flourish on every card.

### Inputs / Fields

- **Style:** Inputs sit on `colors.bg-secondary`, use cool borders, 44px minimum height, 8-10px radius, and inherited Inter typography.
- **Placeholder:** Placeholder text uses `colors.text-muted` and must remain readable on dark surfaces.
- **Focus:** Focus uses the shared blue outline, never a low-contrast glow alone.
- **Search:** Search fields combine an icon, muted label color, transparent input, and full-width behavior inside responsive toolbars.
- **Chat:** Chat input is paired with a 44px square send button using `colors.ai-accent`.

### Navigation

- **Header:** Sticky top header at 56-58px height, dark translucent background, 1px bottom border, and 18px blur. Brand stays centered on desktop and switches to mobile brand placement below 860px.
- **Left panel:** Sticky at 68px on desktop, 176px expanded shell, 66px collapsed shell, 46px nav rows, 34px icon cells. At max 920px it becomes static and horizontally tolerant.
- **Active state:** Active nav uses blue tonal fill, blue border, and primary text. Hover uses gray-blue tonal fill with no excessive motion.
- **Language switch:** Segmented pill control with 44px minimum buttons on mobile.

### Match Stage

- **Role:** The signature high-emotion football surface. It frames teams, flags, athletes, competition, score context, and kickoff/stadium metadata.
- **Background:** Use football-field green and signal blue radial gradients over dark navy. A subtle grid mask is allowed inside the stage only.
- **Typography:** Team names use uppercase 40-44px heavy text with text balancing and overflow wrapping. Decorative vertical side names are low-opacity and non-interactive.
- **Responsive:** Collapse to a single-column team deck below 980px; remove team translation offsets; keep scores and labels centered.

### Prediction, Probability, and Confidence

- **Winner statement:** Lead with a green model signal, then a 34px heavy winner line, then a concise explanation under 70ch.
- **Probability rows:** Three-column row: team/outcome, track, percentage. Bars are 6-9px high with pill ends.
- **Chart lines:** Home is solid green, draw is dashed orange, away is dashed blue. Axis labels stay muted and small.
- **Confidence:** Use segmented or continuous meters with green fill for confident values. Include rationale text; do not show a score without explanation.

### Market Opportunities

- **Default markets:** Prioritize Asian Handicap, Over/Under, 1X2, cards, and corners. These are the default market families for Vietnamese users.
- **Desktop:** Use dense tables when comparison matters. Table shells need horizontal overflow, fixed column widths, cool borders, and alternating dark row fills.
- **Mobile:** Convert tables into stacked cards below 780px. Preserve data labels through `data-label` style labels, not by hiding meaning.
- **Selection:** Selected market cards use violet border and violet tonal fill. Risk, confidence, and decision each require separate visual treatment.

### AI Feed and Chat

- **AI feed:** Timeline events use compact two-column rows with time, title, explanation, and optional impact pill. The vertical timeline line is a structural element, not decoration.
- **Chat messages:** AI messages use bordered secondary surfaces; user messages use violet tonal fill. Keep message width at 92% on desktop and full width on mobile.
- **Empty states:** Timeline and match states use dashed or cool bordered panels with explanatory text. Empty states should teach what will appear, not just say nothing is available.

## 6. Do's and Don'ts

### Do:

- **Do** preserve the "Prediction first" hierarchy: match context, likely outcome, confidence, reasoning, markets, movement, live feed, and chat.
- **Do** use the existing token values from `frontend/src/styles/abstracts/_variables.scss` and the CSS variables in `frontend/src/styles/base/_global.scss`.
- **Do** keep primary working surfaces on dark navy with `colors.card`, `colors.bg-secondary`, and `colors.border`.
- **Do** use `colors.ai-accent` specifically for AI reasoning, selected market state, chat send, confidence rings, and model-labeled UI.
- **Do** keep all interactive targets at least 44px high on touch surfaces.
- **Do** keep transitions between 160ms and 220ms, and respect reduced motion.
- **Do** use skeletons, status panels, or progress cards for loading. The current loading overlay is acceptable for blocking analysis states.
- **Do** make probability changes legible with direction, magnitude, cause, and market impact.
- **Do** include text labels alongside color-coded state. Green, orange, red, blue, and violet are never the only carrier of meaning.
- **Do** use real football assets, flags, and brand imagery when a hero or match stage needs emotional context.

### Don't:

- **Don't** make the product feel like sportsbook clutter.
- **Don't** make the product feel like Bloomberg-terminal density.
- **Don't** make the product feel like traditional betting dashboards.
- **Don't** make the product feel like complex quant interfaces.
- **Don't** use decorative SaaS marketing layouts on task screens.
- **Don't** use AI-generated dashboard tropes such as generic identical card grids, weak hierarchy, or ornamental effects that do not support decision-making.
- **Don't** introduce gradient text, thick side-stripe borders, glassmorphism as default, or oversized rounded cards.
- **Don't** add new top-level accent colors without a state role. The palette already has AI, info, success, warning, and danger.
- **Don't** use full-saturation color on inactive surfaces.
- **Don't** hide table meaning on mobile. If a table collapses, every cell still needs a visible label.
- **Don't** use chart vocabulary from betting odds or candlestick trading. Worldian shows probability movement, not trading price action.
- **Don't** place chat, AI feed, or secondary analytics above the winner signal on the main dashboard.
