# Moby Dicks Design System

The visual language for mobydicks.org. Two surfaces, one system:

- **Public site** — cinematic, editorial, broadcast-grade. Built to make a visitor ask
  *"why is this softball team's website this nice?"*
- **Admin / scorebook** — the same tokens, tuned for speed, density and thumb reach on a
  phone at a dark field. Usability outranks spectacle here.

Everything below is implemented as tokens in `src/app/globals.css` under `@theme`.
Use the tokens. Do not reach for raw Tailwind palette colors (`blue-600`, `slate-800`, …)
in product code — if a value is missing, add a token.

---

## 1. Color

### 1.1 Brand, sampled from the source

The palette is derived from the actual team logo (`melville_moby.png`), not invented.
Modal pixel values from the artwork:

| Role | Hex | Notes |
|------|-----|-------|
| Navy | `#002779` | 58% of logo pixels. The brand anchor. |
| Gold | `#FFD920` | The accent. Warm, saturated, slightly green-shifted. |
| White | `#FFFFFF` | The whale, the linework. |

### 1.2 Scales

Navy — the structural color. Deep values carry the page; mid values are interactive.

```
--color-navy-950  #000B1F   page base, under-image wash
--color-navy-900  #001238   panel base
--color-navy-800  #001C56   raised panel
--color-navy-700  #002779   ★ BRAND
--color-navy-600  #0A3A9E   hover / active fill
--color-navy-500  #1B52C4   focus ring, link on dark
--color-navy-400  #4C7FE0   secondary accent text
--color-navy-300  #8AAEEE   quiet accent on dark
```

Gold — reserved for *emphasis and honor*. Player of the Game, records, the single most
important number on a screen. Overuse kills it; if more than ~5% of a viewport is gold,
cut back.

```
--color-gold-600  #B38F00   pressed
--color-gold-500  #E6C200   hover
--color-gold-400  #FFD920   ★ BRAND
--color-gold-300  #FFE566
--color-gold-200  #FFF0A3   gold text on navy at small sizes
```

Ink — near-blacks for broadcast panels and the scorebook, where navy would be too rich.

```
--color-ink-950   #05070C
--color-ink-900   #0A0E16
--color-ink-800   #121722
--color-ink-700   #1C2331
```

Steel — the neutral ramp. Borders, metadata, disabled states.

```
--color-steel-700 #28313F
--color-steel-600 #3A4557
--color-steel-500 #55637A
--color-steel-400 #7D8CA3   ← minimum for body text on dark (AA at 16px)
--color-steel-300 #A8B4C6
--color-steel-200 #CDD5E0
--color-steel-100 #E6EAF0
```

Paper — light surfaces (admin tables, print-ish editorial).

```
--color-paper     #F7F8FA
--color-paper-dim #ECEFF4
```

### 1.3 Semantic

```
--color-win       #18B368
--color-loss      #E5484D
--color-tie       #7D8CA3
--color-live      #FF3B30   pulsing LIVE dot only — never a fill
--color-focus     #4C7FE0
```

### 1.4 Rules

- Default surface is dark. The public site is a night-game broadcast.
- Navy and ink do not mix inside a single component. Pick one substrate per module:
  navy for editorial/marketing modules, ink for data/broadcast modules.
- Gold never sits on white and never on `navy-300+`. Gold lives on `navy-900`/`ink-900`.
- Never use color as the only signal for W/L — always pair with the letter and the score.

---

## 2. Typography

Four roles, three families. Numbers get first-class treatment because on a sports site
the numbers *are* the content.

| Role | Family | Token | Where |
|------|--------|-------|-------|
| Display | Archivo (variable `wght` 400–900, `wdth` 62–125) | `--font-display` | Hero, section headers, player names, scoreboard |
| Editorial | Newsreader (variable) | `--font-editorial` | Captain's Log body, pull quotes, long-form |
| Body / UI | Inter (variable) | `--font-body` | Everything functional |
| Numeric | Archivo, `tabular-nums`, tight tracking | `--font-numeric` | Every stat, score, jersey number |

**Why Archivo:** it carries a real width axis. Compressing to `wdth: 75` at `wght: 800`
produces the tall condensed athletic caps that broadcast graphics live on — without
shipping a second font file or resorting to `scaleX()`.

### 2.1 Display scale

Display type is *tight*. Tracking goes negative as size goes up.

```
.type-hero      clamp(3.5rem, 11vw, 9rem)   wght 800  wdth 78   tracking -0.03em  leading .86  uppercase
.type-display   clamp(2.5rem, 6vw, 4.5rem)  wght 800  wdth 82   tracking -0.02em  leading .92  uppercase
.type-section   1.75rem                     wght 700  wdth 88   tracking  0.01em  leading 1.1  uppercase
.type-eyebrow   0.75rem                     wght 700             tracking  0.18em  uppercase
```

### 2.2 Numeric scale

Tabular figures everywhere, so columns of stats align and live scores don't jitter as
digits change.

```
.num-scoreboard clamp(3rem, 9vw, 6.5rem)  wght 800 wdth 75 tracking -0.02em tnum
.num-stat-xl    2.75rem                   wght 800 wdth 80 tnum
.num-stat       1.5rem                    wght 700 wdth 85 tnum
.num-table      0.9375rem                 wght 600 tnum
.num-jersey     — see §4.1
```

### 2.3 Batting-average formatting

Rates below 1.000 (AVG, OBP, SLG) render **without** the leading zero — `.568`, never
`0.568`. The legacy site got this wrong on every page; the new one fixes it centrally in
`formatRate()` (`src/lib/format.ts`). OPS may exceed 1.000 and keeps its integer digit.

### 2.4 Editorial

Captain's Log is the one place the site slows down. Newsreader at `1.1875rem/1.75`,
`max-width: 68ch`, generous paragraph spacing. It should read like a column, not a feed.

---

## 3. Space, geometry, depth

### 3.1 Spacing

A 4px base, but the *section* rhythm is what matters:

```
--space-section-y   clamp(4rem, 9vw, 8rem)    between major page sections
--space-block-y     clamp(2rem, 4vw, 3.5rem)  between blocks inside a section
--space-gutter      clamp(1rem, 4vw, 2.5rem)  page side gutter (never below 16px)
```

Content max width `1280px`; editorial measure `68ch`; wide/bleed modules run full width.

### 3.2 Radius — deliberately sharp

Sports graphics are built from hard geometry. Pill-shaped everything reads as SaaS.

```
--radius-none  0px      score strips, stat bars, number blocks, table cells
--radius-xs    2px      default for data surfaces
--radius-sm    4px      cards, inputs
--radius-md    6px      modals, popovers
--radius-full  9999px   ONLY: avatars, the LIVE dot, filter chips
```

There is no `--radius-lg`. If something needs a 16px radius, it is the wrong component.

### 3.3 Depth

No generic `box-shadow: 0 4px 6px rgba(0,0,0,.1)`. Depth comes from, in order of preference:

1. **Hairline borders** — `1px solid` at 8–14% white. The primary separation device.
2. **Substrate shift** — `ink-900` panel on `ink-950` page.
3. **Image masks** — `linear-gradient(to top, navy-950 0%, transparent 60%)` over photos
   so type sits on the image, not in a box on top of it.
4. **Accent rules** — a 3px gold or navy left-edge bar to mark importance.
5. **Lighting** — a single wide, very low-opacity radial behind a focal element.

Shadows are permitted only for genuinely floating UI (dropdowns, the scorebook's
confirmation sheet), and then as a tight dark spread, not a soft gray halo.

---

## 4. Sports graphics language

The reusable motifs. These are what make it feel like one product rather than a set of
pages. Implemented in `src/components/sports/`.

### 4.1 Number block — `<JerseyNumber>`

A jersey number is never inline text. It is a block: square-ish, zero radius, gold or
white numerals in Archivo `wght 800 / wdth 70`, optically centered (digits sit slightly
high, so the block pads bottom-heavy). Sizes `sm | md | lg | hero`. At `hero` it is a
watermark behind the player photo at 6–10% opacity.

### 4.2 Score strip — `<ScoreStrip>`

The horizontal result unit used on schedule rows, game pages and the home rail.

```
┌────────────────────────────────────────────────────────┐
│ ▌ MOBY DICKS          18                               │
│ ▌ WOLFPACK            16        FINAL   APR 15         │
└────────────────────────────────────────────────────────┘
  ▲ 3px accent bar, gold when Melville wins
```

Winner's row is full-contrast white; loser's row drops to `steel-400`. Zero radius.
Status label (`FINAL` / `LIVE` / `F/8` / the date) is `.type-eyebrow`.

### 4.3 Status labels

`FINAL` — `steel-400`, letterspaced.
`LIVE` — `--color-live` dot (pulsing, respects `prefers-reduced-motion`) + white label.
`UPCOMING` — outlined, `steel-500`.
`PPD` / `CXL` — struck-through metadata.

### 4.4 Stat bar — `<StatBar>`

Leaderboard rows: rank numeral, name, value, and a bar whose width is the value relative
to the category leader. Bar is a flat navy fill with a gold cap on the leader. Zero radius,
2px tall at rest, 4px on hover.

### 4.5 Lower third — `<PlayerLowerThird>`

The broadcast name plate: a navy slab with a gold top rule, jersey block at left, name in
display caps, position in eyebrow type beneath. Used on the player hero and POTG graphics.

### 4.6 Player of the Game — `<PotgCard>`

The one place the system goes maximal: full-bleed player photo, gold rule, star glyph,
`PLAYER OF THE GAME` in eyebrow gold, name at `.type-display`, three headline stats in
`.num-stat-xl`. This is the site's signature graphic.

### 4.7 Diamond — `<BaseDiamond>`

Base state as an actual rotated square, bases as small squares (not circles). Occupied
bases fill gold; empty bases are hairline outlines. Used live in the scorebook and on the
public live view. Always paired with a text equivalent for screen readers
(e.g. "Runners on first and third, two out").

### 4.8 Rank numeral

Leaderboard positions are oversized, low-contrast display numerals (`steel-700`) sitting
*behind* the row content — an editorial device, not a badge.

---

## 5. Motion

Motion earns its place or it is removed. `motion` (Framer) only where it improves
comprehension:

- **Stat counters** count up on first view (`<NumberTicker>`) — reinforces that these are
  live, computed numbers.
- **Score changes** in the live view slide/blur the changed digit only.
- **Hero image** gets a slow scale-down on load (1.06 → 1.0 over 1.2s) — cinematic settle.
- **Scroll reveals** are a 12px rise + fade, 400ms, staggered 60ms. Once. Never on scroll-back.

Durations: `120ms` state, `240ms` transition, `400ms` reveal, `1200ms` cinematic.
Easing: `cubic-bezier(0.2, 0, 0, 1)`.

**Every** motion rule above is wrapped in `@media (prefers-reduced-motion: no-preference)`.
With reduced motion, counters show final values immediately and reveals are instant.

---

## 6. Accessibility

- Body text on dark meets AA: `steel-300`+ on `ink-900`/`navy-900`. `steel-500` is for
  decorative metadata only.
- Gold `#FFD920` on `navy-900` is ~11:1 — safe. Gold on white is ~1.5:1 — **banned**.
- Focus is always visible: 2px `--color-focus` ring, 2px offset. Never `outline: none`.
- Scorebook touch targets are ≥ 56px tall; primary outcome buttons ≥ 72px.
- The base diamond, W/L color, and the LIVE dot all have text equivalents.
- Every stat table is a real `<table>` with `<th scope>` and a `<caption>`.

---

## 7. Anti-patterns

Explicitly rejected for this project:

- Endless identical `rounded-2xl` cards in a 3-column grid
- Giant gradient blobs / mesh backgrounds
- Glassmorphism as a default surface treatment
- Purple-to-blue SaaS gradients
- Emoji as UI iconography (the legacy site used 📷 ⚓ ★ as interface elements)
- Centered hero + subtitle + two buttons
- `0.568` — see §2.3
- Stat values stored as columns and hand-maintained — see `docs/ARCHITECTURE.md`
