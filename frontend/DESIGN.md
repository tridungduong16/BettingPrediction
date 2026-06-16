# Worldian - AI World Cup Prediction Platform

## Design Philosophy

### Mission

Help users understand what the AI currently believes about a match and why.

The product is not a sportsbook.

The product is not a Bloomberg terminal.

The product is an AI reasoning engine for sports predictions.

### Core Principles

1. Prediction First
2. Reasoning Before Analytics
3. Explain Probability Changes
4. Real-Time AI Updates
5. Minimal UI, Maximum Information

Users should be able to answer the following questions within 5 seconds:

* Who is likely to win?
* How confident is the AI?
* Why does the AI think so?
* What changed recently?
* What other markets are interesting?

---

# Product Positioning

Combines:

* ChatGPT
* Perplexity
* Polymarket
* SofaScore

Avoids:

* Bloomberg Terminal
* Traditional Betting Dashboards
* Complex Quant Interfaces

---

# Visual Style

## Theme

Dark mode by default.

Premium sports analytics aesthetic.

Professional but approachable.

### Inspiration

* Linear
* Vercel
* Perplexity
* Polymarket
* Arc Browser

---

# Color System

## Background

Primary Background

#050B14

Secondary Background

#08121F

Card Background

#0D1726

Card Hover

#132238

Border

#1E293B

---

## Semantic Colors

Success

#22C55E

Warning

#F59E0B

Danger

#EF4444

Info

#3B82F6

AI Accent

#8B5CF6

---

# Typography

Font Family

Inter

Fallback

system-ui

---

## Type Scale

Hero

32px
Bold

Section Title

18px
SemiBold

Body

14px
Regular

Caption

12px
Regular

Probability

36px
Bold

Confidence

24px
SemiBold

---

# Layout

Maximum Width

1600px

Content Width

1400px

Grid

12 columns

Spacing System

4
8
16
24
32
48
64

Radius

16px

---

# Information Hierarchy

Priority Order

1. Match
2. Prediction
3. Confidence
4. Reasoning
5. Prediction Markets
6. Probability Movement
7. AI Feed
8. Chat

---

# Home Screen

## Match Hero

Large hero section.

Contains:

* Team flags
* Team names
* Competition
* Kickoff time
* Stadium

Example

Brazil vs France

---

## AI Prediction Card

Shows:

Winner Probability

Brazil 58%
Draw 21%
France 21%

Confidence

8.2 / 10

Model Status

Live

Last Updated

18:42:21

---

# Prediction Markets

Display as cards.

Each card contains:

Market Name

Top Prediction

Probability

Examples:

## Match Winner

Brazil Win

58%

---

## Correct Score

2-1 Brazil

18%

---

## Total Goals

Over 2.5

72%

---

## Both Teams To Score

Yes

66%

---

## Yellow Cards

Over 3.5

61%

---

## First Goal Scorer

Vinicius Jr

19%

---

## Anytime Goalscorer

Mbappe

48%

---

## To Qualify

Brazil

74%

---

# AI Reasoning

Most important section.

Shows why probabilities exist.

Each reasoning item includes:

Reason

Impact

Direction

Example

France centre-back doubtful

+1.8%

Brazil xG improving

+1.2%

Heavy rain forecast

+0.6%

Market money on France

-0.8%

---

# Probability Movement

Shows how AI opinion changes over time.

Not a betting odds chart.

Not a candlestick chart.

Only probability movement.

Example

Brazil Win

52%
54%
56%
58%

Past 24 Hours

---

# AI Insight Feed

Real-time event stream.

Each insight contains:

Timestamp

Event

Impact

Affected Market

Example

18:41

Mbappe doubtful

+1.2%

Brazil Win

---

18:35

Brazil attacking metrics improved

+0.9%

Brazil Win

---

18:28

Heavy rain expected

+0.4%

Under 2.5 Goals

---

# Ask AI

Conversational interface.

Users can ask:

Why Brazil?

Who scores first?

What is the most likely score?

How does rain affect this match?

What changed in the last hour?

---

# Components

## Prediction Card

Structure

Market

Prediction

Probability

Optional Trend

---

## Reason Card

Structure

Reason

Impact

Confidence

---

## Insight Item

Structure

Timestamp

Insight

Impact

Affected Market

---

## Confidence Bar

Range

0–10

Visual

Gradient Fill

Green = High Confidence

Yellow = Medium Confidence

Red = Low Confidence

---

# Animation

Keep minimal.

Allowed:

* Number transitions
* Probability updates
* Card hover
* Feed updates

Avoid:

* Heavy motion
* Parallax
* Excessive charts
* Fancy dashboard effects

---

# Mobile Experience

Single-column layout.

Order

1. Match
2. Prediction
3. Reasoning
4. Markets
5. AI Feed
6. Chat

Bottom Navigation

Home

Live

Predictions

Alerts

Profile

---

# Design Goal

Users should feel:

"The AI has an opinion."

More importantly:

"The AI can explain why its opinion changed."

Prediction alone creates curiosity.

Reasoning creates trust.
